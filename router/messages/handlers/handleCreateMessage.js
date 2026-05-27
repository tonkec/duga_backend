const {
  ChatUser,
  Message,
  MessageMention,
  Notification,
  User,
} = require('../../../models');
const {
  buildMentionRows,
  getMentionUserIdsOutsideChat,
  hasInvalidMentionUserIds,
  normalizeMentionUserIds,
} = require('../../../utils/messageMentions');
const {
  resolveMessagePhotoUrl,
} = require('../../../utils/resolveMessagePhotoUrl');
const { sanitizePlainText } = require('../../../utils/plainText');

const ALLOWED_MESSAGE_TYPES = new Set(['text', 'image', 'gif']);
const MAX_MESSAGE_LENGTH = 5000;

const handleCreateMessage = async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const {
      chatId,
      message,
      mentions,
      type = 'text',
      messagePhotoUrl = null,
    } = req.body;
    const parsedChatId = Number(chatId);
    const mentionUserIds = normalizeMentionUserIds(mentions);
    const normalizedType = typeof type === 'string' ? type.trim() : type;
    const normalizedMessage =
      typeof message === 'string' ? message.trim() : message;

    if (!parsedChatId) {
      return res.status(400).json({ error: 'Invalid or missing chatId' });
    }

    if (!ALLOWED_MESSAGE_TYPES.has(normalizedType)) {
      return res.status(400).json({ error: 'Invalid message type' });
    }

    if (message !== undefined && typeof message !== 'string') {
      return res.status(400).json({ error: 'Message must be a string' });
    }

    if (
      typeof normalizedMessage === 'string' &&
      normalizedMessage.length > MAX_MESSAGE_LENGTH
    ) {
      return res.status(400).json({
        error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less`,
      });
    }

    if (!mentionUserIds || hasInvalidMentionUserIds(mentionUserIds)) {
      return res.status(400).json({ error: 'Invalid mentions' });
    }

    if (
      (!normalizedMessage ||
        typeof normalizedMessage !== 'string' ||
        normalizedMessage.length === 0) &&
      !messagePhotoUrl
    ) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const chatUser = await ChatUser.findOne({
      where: {
        chatId: parsedChatId,
        userId,
      },
    });

    if (!chatUser) {
      return res
        .status(403)
        .json({ error: 'You do not have access to this chat' });
    }

    const chatMembers = await ChatUser.findAll({
      where: { chatId: parsedChatId },
      attributes: ['userId'],
    });
    const memberIds = chatMembers.map((member) => Number(member.userId));
    const invalidMentionUserIds = getMentionUserIdsOutsideChat(
      mentionUserIds,
      memberIds
    );

    if (invalidMentionUserIds.length > 0) {
      return res.status(400).json({ error: 'Mentions must be chat members' });
    }

    const finalMessagePhotoUrl = await resolveMessagePhotoUrl({
      messagePhotoUrl,
      type: normalizedType,
      userId,
    });

    const savedMessage = await Message.create({
      chatId: parsedChatId,
      fromUserId: userId,
      type: normalizedType,
      message: normalizedMessage ? sanitizePlainText(normalizedMessage) : null,
      messagePhotoUrl: finalMessagePhotoUrl,
    });

    if (mentionUserIds.length > 0) {
      await MessageMention.bulkCreate(
        buildMentionRows(savedMessage.id, mentionUserIds)
      );
    }

    const mentionedUsers =
      mentionUserIds.length > 0
        ? await User.findAll({
            where: { id: mentionUserIds },
            attributes: ['id', 'publicId', 'username', 'avatar'],
          })
        : [];

    const payload = {
      ...(savedMessage.toJSON ? savedMessage.toJSON() : savedMessage),
      mentionedUsers,
    };

    const io = req.app.get('io');
    await Promise.all(
      chatMembers
        .filter((member) => member.userId !== userId)
        .map(async (member) => {
          const notification = await Notification.create({
            userId: member.userId,
            type: 'message',
            content: 'Nova poruka.',
            actionId: savedMessage.id,
            actionType: 'message',
            chatId: parsedChatId,
          });

          if (io?.to) {
            io.to(`user:${member.userId}`).emit(
              'new_notification',
              notification
            );
          }
        })
    );

    if (io?.to) {
      io.to(`chat:${parsedChatId}`).emit('received', payload);
    } else if (io?.emit) {
      io.emit('received', payload);
    }

    return res.status(201).json({ data: payload });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error('❌ Error creating message:', error);
    return res
      .status(500)
      .json({ error: 'Error occurred while creating message' });
  }
};

module.exports = handleCreateMessage;
