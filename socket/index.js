const socketIo = require('socket.io');
const { Sequelize, sequelize } = require('../models');
const Message = require('../models').Message;
const MessageMention = require('../models').MessageMention;
const MessageReaction = require('../models').MessageReaction;
const User = require('../models').User;
const PhotoComment = require('../models').PhotoComment;
const Chat = require('../models').Chat;
const ChatUser = require('../models').ChatUser;
const UploadMention = require('../models').UploadMention;
const AppSession = require('../models').AppSession;
const users = new Map();
const userSockets = new Map();
const pendingOfflineTimers = new Map();
const Notification = require('../models').Notification;
const PhotoLikes = require('../models').PhotoLikes;
const socketCanAccess = require('../utils/socketAccess');
const getSocketUser = require('../utils/socketAccess').getSocketUser;
const normalizeS3Key = require('../utils/normalizeS3Key');

const { API_BASE_URL } = require('../consts/apiBaseUrl');
const { attachSecureUrl } = require('../utils/secureUploadUrl');
const {
  getCookie,
  hashSessionId,
  isValidSessionId,
  SESSION_COOKIE,
} = require('../utils/appSession');
const { allowSocketOrigin } = require('../utils/originAllowlist');
const { resolveMessagePhotoUrl } = require('../utils/resolveMessagePhotoUrl');
const { sanitizePlainText } = require('../utils/plainText');
const {
  buildMentionRows,
  getMentionUserIdsOutsideChat,
  hasInvalidMentionUserIds,
  normalizeMentionUserIds,
} = require('../utils/messageMentions');

const SOCKET_OFFLINE_DELAY_MS = Number(
  process.env.SOCKET_OFFLINE_DELAY_MS || 5000
);
const USER_STATUSES = new Set(['online', 'offline']);
const EMOJI_REACTION_PATTERN =
  /^(?=.*(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}))(?:(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200d|\ufe0f))+$/u;

const getSocketSessionId = (socket) =>
  getCookie({ headers: socket.handshake.headers || {} }, SESSION_COOKIE);

const formatCommentSocketPayload = (comment) => ({
  ...comment.toJSON(),
  securePhotoUrl: comment.imageUrl
    ? attachSecureUrl(
        API_BASE_URL,
        comment.imageUrl.startsWith(`${process.env.NODE_ENV}/`)
          ? comment.imageUrl
          : `${process.env.NODE_ENV}/${normalizeS3Key(comment.imageUrl)}`
      )
    : null,
});

const parseCommentSocketPayload = (data) => {
  const payload = data?.data ?? data;
  return {
    payload,
    commentId: parseInt(payload?.id ?? payload?.commentId, 10),
    uploadId: payload?.uploadId != null ? parseInt(payload.uploadId, 10) : null,
  };
};

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const addNumericUserId = (recipientIds, userId) => {
  const parsedUserId = parsePositiveInteger(userId);
  if (parsedUserId) {
    recipientIds.add(parsedUserId);
  }
};

const getOnlineSocketIdsForUser = (userId) => {
  const parsedUserId = parsePositiveInteger(userId);
  if (!parsedUserId) return [];

  const onlineUser =
    users.get(parsedUserId) || users.get(String(parsedUserId)) || null;

  return onlineUser?.sockets || [];
};

const getSocketChatMembership = async (socket, rawChatId) => {
  const user = socket.appUser || (await getSocketUser(socket));
  const chatId = parsePositiveInteger(rawChatId);

  if (!user || !chatId) {
    return { user, chatId, membership: null, error: 'Invalid chat payload' };
  }

  const membership = await ChatUser.findOne({
    where: { chatId, userId: user.id },
  });

  if (!membership) {
    return { user, chatId, membership: null, error: 'Forbidden' };
  }

  return { user, chatId, membership, error: null };
};

const getChatMemberIds = async (chatId) => {
  const memberships = await ChatUser.findAll({
    where: { chatId },
    attributes: ['userId'],
  });

  return memberships
    .map(({ userId }) => parsePositiveInteger(userId))
    .filter(Boolean);
};

const emitToChatMembers = async ({
  io,
  chatId,
  event,
  payload,
  excludeUserIds = [],
}) => {
  const memberIds = await getChatMemberIds(chatId);
  const excluded = new Set(excludeUserIds.map(Number));
  const emittedSocketIds = new Set();

  memberIds.forEach((memberId) => {
    if (excluded.has(memberId)) return;

    getOnlineSocketIdsForUser(memberId).forEach((socketId) => {
      if (emittedSocketIds.has(socketId)) return;
      emittedSocketIds.add(socketId);
      io.to(socketId).emit(event, payload);
    });
  });

  return memberIds;
};

const canDeleteChatFromSocket = async ({ chatId, membership }) => {
  const chat = await Chat.findByPk(chatId, { attributes: ['id', 'type'] });
  if (!chat) return false;

  return chat.type !== 'group' || membership.role === 'admin';
};

const getUploadCommentRecipients = async (uploadId, comment) => {
  const recipientIds = new Set();
  addNumericUserId(recipientIds, comment?.userId);

  const [upload] = await sequelize.query(
    `SELECT "userId" FROM "Uploads" WHERE id = :uploadId`,
    {
      replacements: { uploadId },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  const photoOwnerId = upload?.userId;
  addNumericUserId(recipientIds, photoOwnerId);

  const uploadMentions = await UploadMention.findAll({
    where: { uploadId },
    attributes: ['userId'],
  });

  uploadMentions.forEach((mention) => {
    addNumericUserId(recipientIds, mention.userId);
  });

  return {
    photoOwnerId,
    recipientIds: Array.from(recipientIds),
  };
};

const emitToUploadCommentRecipients = async ({
  io,
  uploadId,
  comment,
  event,
  payload,
}) => {
  const { photoOwnerId, recipientIds } = await getUploadCommentRecipients(
    uploadId,
    comment
  );
  const emittedSocketIds = new Set();

  recipientIds.forEach((recipientId) => {
    getOnlineSocketIdsForUser(recipientId).forEach((socketId) => {
      if (emittedSocketIds.has(socketId)) return;
      emittedSocketIds.add(socketId);
      io.to(socketId).emit(event, payload);
    });
  });

  return { photoOwnerId, recipientIds };
};

const validateReactionEmoji = (emoji) => {
  if (typeof emoji !== 'string' || emoji.trim().length === 0) {
    return null;
  }

  const normalizedEmoji = emoji.trim();
  if (
    normalizedEmoji.length > 32 ||
    !EMOJI_REACTION_PATTERN.test(normalizedEmoji)
  ) {
    return null;
  }

  return normalizedEmoji;
};

const summarizeMessageReactions = (reactions = []) => {
  const counts = new Map();

  reactions.forEach((reaction) => {
    if (!reaction?.emoji) return;
    counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
  });

  return {
    reactions: [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([emoji, count]) => ({ emoji, count })),
    reactionCount: reactions.length,
  };
};

const getMessageReactionSummary = async (messageId) => {
  const reactions = await MessageReaction.findAll({
    where: { messageId },
    attributes: ['emoji', 'userId'],
  });

  return summarizeMessageReactions(reactions);
};

const getMessageReactionPayload = async ({
  message,
  userId,
  emoji,
  action,
}) => ({
  messageId: message.id,
  chatId: message.chatId,
  userId,
  emoji,
  action,
  ...(await getMessageReactionSummary(message.id)),
});

const getAccessibleMessageForSocket = async (socket, rawMessageId) => {
  const user = socket.appUser || (await getSocketUser(socket));
  const messageId = Number(rawMessageId);

  if (!user || !messageId) {
    return { user, message: null, error: 'Invalid message reaction payload' };
  }

  const message = await Message.findByPk(messageId);
  if (!message) {
    return { user, message: null, error: 'Message not found' };
  }

  const chatMembers = await ChatUser.findAll({
    where: { chatId: message.chatId },
    attributes: ['userId'],
  });
  const memberIds = chatMembers.map(({ userId }) => Number(userId));

  if (!memberIds.includes(Number(user.id))) {
    return { user, message, error: 'You do not have access to this chat' };
  }

  return { user, message, error: null };
};

const joinSocketRooms = async (socket, user) => {
  socket.join(`user:${user.id}`);

  const memberships = await ChatUser.findAll({
    where: { userId: user.id },
    attributes: ['chatId'],
  });
  memberships.forEach(({ chatId }) => socket.join(`chat:${chatId}`));
};

const userSessionSockets = new Map();

const clearPendingOfflineTimer = (userId) => {
  const timer = pendingOfflineTimers.get(userId);
  if (!timer) return;

  clearTimeout(timer);
  pendingOfflineTimers.delete(userId);
};

const trackSessionSocket = (userId, sessionId, socketId) => {
  if (!sessionId) return;

  if (!userSessionSockets.has(userId)) {
    userSessionSockets.set(userId, new Map());
  }

  const sessions = userSessionSockets.get(userId);
  const sockets = sessions.get(sessionId) || new Set();
  sockets.add(socketId);
  sessions.set(sessionId, sockets);
};

const untrackSessionSocket = (userId, sessionId, socketId) => {
  const sessions = userSessionSockets.get(userId);
  if (!sessions) return;

  const sockets = sessions.get(sessionId);
  if (!sockets) return;

  sockets.delete(socketId);
  if (!sockets.size) {
    sessions.delete(sessionId);
  }
  if (!sessions.size) {
    userSessionSockets.delete(userId);
  }
};

const SocketServer = (server, app) => {
  const io = socketIo(server, {
    cors: {
      origin: allowSocketOrigin,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      allowedHeaders: ['Content-Type', 'x-csrf-token'],
      credentials: true,
    },
  });

  app.set('io', io);
  app.set('revokeUserSessionsExcept', (userId, activeSessionId) => {
    const sessions = userSessionSockets.get(userId);
    if (!sessions) return;

    sessions.forEach((socketIds, sessionId) => {
      if (sessionId === activeSessionId) return;

      socketIds.forEach((socketId) => {
        io.to(socketId).emit('session-revoked');
        io.sockets.sockets.get(socketId)?.disconnect(true);
      });
    });
  });
  app.set('revokeUserSession', (userId, revokedSessionId) => {
    const sessions = userSessionSockets.get(userId);
    if (!sessions) return;

    const socketIds = sessions.get(revokedSessionId);
    if (!socketIds) return;

    socketIds.forEach((socketId) => {
      io.to(socketId).emit('session-revoked');
      io.sockets.sockets.get(socketId)?.disconnect(true);
    });
  });

  io.use(async (socket, next) => {
    const sessionId = getSocketSessionId(socket);
    if (!sessionId) {
      return next(new Error('Missing app session'));
    }
    if (!isValidSessionId(sessionId)) {
      return next(new Error('Invalid app session'));
    }

    try {
      const appSession = await AppSession.findOne({
        where: {
          sessionIdHash: hashSessionId(sessionId),
          revokedAt: null,
          expiresAt: { [Sequelize.Op.gt]: new Date() },
        },
      });

      if (!appSession?.auth0Id) {
        return next(new Error('Session revoked'));
      }

      const user = await User.findOne({
        where: { auth0Id: appSession.auth0Id },
      });
      if (!user) {
        return next(new Error('Unauthorized'));
      }

      socket.user = {
        sub: appSession.auth0Id,
        user: {
          id: user.id,
          email: user.email,
          auth0Id: user.auth0Id,
        },
      };
      socket.appUser = user;
      socket.appSession = appSession;
      socket.appSessionId = sessionId;
      next();
    } catch (err) {
      console.error('❌ Socket session verification failed:', err.message);
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected');
    if (socket.appUser) {
      joinSocketRooms(socket, socket.appUser).catch((error) => {
        console.error('❌ Failed to join socket rooms:', error);
      });
    }

    socket.on('join', async () => {
      const user = socket.appUser || (await getSocketUser(socket));
      if (!user) {
        console.error('❌ Unauthorized join: user not found');
        return;
      }
      const userId = user.id;
      clearPendingOfflineTimer(userId);
      setUsers(user, socket);
      trackSessionSocket(user.id, socket.appSessionId, socket.id);
      await joinSocketRooms(socket, user);
      await User.update({ status: 'online' }, { where: { id: userId } });

      const chatters = await getChatters(userId);
      chatters.forEach((chatterId) => {
        if (users.has(chatterId)) {
          users.get(chatterId).sockets.forEach((sockId) => {
            io.to(sockId).emit('status-update', {
              userId: user.id,
              status: 'online',
            });
          });
        }
      });

      if (users.has(user.id)) {
        users.get(user.id).status = 'online';
      }
    });

    socket.on('send-comment', async (data) => {
      try {
        const { commentId: parsedCommentId, uploadId: parsedUploadId } =
          parseCommentSocketPayload(data);

        if (isNaN(parsedUploadId) || isNaN(parsedCommentId)) {
          console.error('❌ Invalid send-comment payload');
          return;
        }

        const user = await getSocketUser(socket);
        if (!user) {
          console.error('❌ Unauthorized send-comment: user not found');
          return;
        }

        const hasAccess = await socketCanAccess({
          socket,
          model: PhotoComment,
          resourceId: parsedCommentId,
        });
        if (!hasAccess) {
          console.error('❌ Forbidden send-comment');
          return;
        }

        const comment = await PhotoComment.findByPk(parsedCommentId, {
          include: [
            { model: User, as: 'user', attributes: ['id', 'username'] },
            { model: User, as: 'taggedUsers', attributes: ['id', 'username'] },
          ],
        });

        if (!comment) {
          console.error('❌ Comment not found:', parsedCommentId);
          return;
        }

        if (parseInt(comment.uploadId, 10) !== parsedUploadId) {
          console.error('❌ Comment uploadId mismatch on send-comment');
          return;
        }

        const commentPayload = {
          data: formatCommentSocketPayload(comment),
        };

        const { photoOwnerId } = await emitToUploadCommentRecipients({
          io,
          uploadId: parsedUploadId,
          comment,
          event: 'receive-comment',
          payload: commentPayload,
        });

        if (
          photoOwnerId &&
          parseInt(photoOwnerId, 10) !== parseInt(user.id, 10)
        ) {
          const notification = await Notification.create({
            userId: photoOwnerId,
            type: 'comment',
            content: `Novi komentar na tvojoj fotografiji.`,
            actionId: parsedUploadId,
            actionType: 'upload',
          });

          if (users.has(photoOwnerId)) {
            users.get(photoOwnerId).sockets.forEach((sockId) => {
              io.to(sockId).emit('new_notification', {
                id: notification.id,
                type: notification.type,
                content: notification.content,
                actionId: notification.actionId,
                actionType: notification.actionType,
                isRead: notification.isRead,
                createdAt: notification.createdAt,
              });
            });
          }
        }
      } catch (error) {
        console.error('🔥 Error in send-comment:', error);
      }
    });

    socket.on('markAsRead', async (data = {}) => {
      const user = socket.appUser || (await getSocketUser(socket));
      const chatId = Number(data.chatId);

      try {
        if (!user || !chatId) {
          console.error('❌ Missing user or chatId in markAsRead');
          return;
        }

        const membership = await ChatUser.findOne({
          where: { chatId, userId: user.id },
        });

        if (!membership) {
          console.error('❌ User cannot access chat notifications:', chatId);
          return;
        }

        const notification = await Notification.findOne({
          where: {
            userId: user.id,
            chatId,
            isRead: false,
          },
          order: [['createdAt', 'DESC']],
        });

        if (!notification) {
          console.error('❌ No unread notification found for user/chat:', {
            userId: user.id,
            chatId,
          });
          return;
        }

        console.log('🔍 Notification ID to mark as read:', notification.id);

        notification.isRead = true;
        await notification.save();

        if (users.has(user.id)) {
          users.get(user.id).sockets.forEach((sockId) => {
            io.to(sockId).emit('markAsRead', notification);
          });
        }

        return notification;
      } catch (error) {
        console.error('🔥 Error in markAsRead:', error);
      }
    });

    socket.on('set-status', async ({ status } = {}, ack) => {
      const user = socket.appUser || (await getSocketUser(socket));
      if (!user) {
        console.error('❌ Unauthorized set-status: user not found');
        ack?.({ ok: false, error: 'Unauthorized' });
        return;
      }
      if (!USER_STATUSES.has(status)) {
        ack?.({ ok: false, error: 'Invalid status' });
        return;
      }
      const userId = user.id;
      clearPendingOfflineTimer(userId);
      if (users.has(userId)) {
        users.get(userId).status = status;
      }

      await User.update({ status }, { where: { id: userId } });

      const chatters = await getChatters(userId);
      chatters.forEach((id) => {
        if (users.has(id)) {
          users.get(id).sockets.forEach((sockId) => {
            io.to(sockId).emit('status-update', { userId, status });
          });
        }
      });

      if (users.has(userId)) {
        users.get(userId).sockets.forEach((sockId) => {
          io.to(sockId).emit('status-update', { userId, status });
        });
      }

      ack?.({ ok: true, status });
    });

    socket.on('delete-comment', async (data) => {
      try {
        const { commentId, uploadId } = parseCommentSocketPayload(data);

        if (isNaN(commentId)) {
          console.error('❌ Invalid delete-comment payload');
          return;
        }

        const user = await getSocketUser(socket);
        if (!user) {
          console.error('❌ Unauthorized delete-comment: user not found');
          return;
        }

        const hasAccess = await socketCanAccess({
          socket,
          model: PhotoComment,
          resourceId: commentId,
        });
        if (!hasAccess) {
          console.error('❌ Forbidden delete-comment');
          return;
        }

        const comment = await PhotoComment.findByPk(commentId);
        if (!comment) {
          console.error('❌ Comment not found:', commentId);
          return;
        }

        if (
          uploadId != null &&
          !isNaN(uploadId) &&
          parseInt(comment.uploadId, 10) !== uploadId
        ) {
          console.error('❌ Comment uploadId mismatch on delete-comment');
          return;
        }

        await emitToUploadCommentRecipients({
          io,
          uploadId: parseInt(comment.uploadId, 10),
          comment,
          event: 'remove-comment',
          payload: {
            data: {
              id: comment.id,
              uploadId: comment.uploadId,
            },
          },
        });
      } catch (error) {
        console.error('🔥 Error in delete-comment:', error);
      }
    });

    socket.on('edit-comment', async (data) => {
      try {
        const { commentId, uploadId } = parseCommentSocketPayload(data);

        if (isNaN(commentId)) {
          console.error('❌ Invalid edit-comment payload');
          return;
        }

        const user = await getSocketUser(socket);
        if (!user) {
          console.error('❌ Unauthorized edit-comment: user not found');
          return;
        }

        const hasAccess = await socketCanAccess({
          socket,
          model: PhotoComment,
          resourceId: commentId,
        });
        if (!hasAccess) {
          console.error('❌ Forbidden edit-comment');
          return;
        }

        const comment = await PhotoComment.findByPk(commentId, {
          include: [
            { model: User, as: 'user', attributes: ['id', 'username'] },
            { model: User, as: 'taggedUsers', attributes: ['id', 'username'] },
          ],
        });

        if (!comment) {
          console.error('❌ Comment not found:', commentId);
          return;
        }

        if (
          uploadId != null &&
          !isNaN(uploadId) &&
          parseInt(comment.uploadId, 10) !== uploadId
        ) {
          console.error('❌ Comment uploadId mismatch on edit-comment');
          return;
        }

        await emitToUploadCommentRecipients({
          io,
          uploadId: parseInt(comment.uploadId, 10),
          comment,
          event: 'update-comment',
          payload: {
            data: formatCommentSocketPayload(comment),
          },
        });
      } catch (error) {
        console.error('🔥 Error in edit-comment:', error);
      }
    });

    socket.on('upvote-upload', async (data) => {
      try {
        const like = data[0];
        const { photoId } = like;
        const user = socket.appUser || (await getSocketUser(socket));
        if (!user) {
          console.error('User not found');
          return;
        }
        const userId = user.id;

        const photoLike = await PhotoLikes.findOne({
          where: {
            photoId,
            userId,
          },
        });

        if (!photoLike) {
          console.error('PhotoLike not found in upvote');
          return;
        }
        const hasAccess = await socketCanAccess({
          socket,
          model: PhotoLikes,
          resourceId: photoLike.id,
        });

        if (!hasAccess) {
          throw new Error('Forbidden: You cannot like this upload.');
        }

        const parsedPhotoId = parseInt(photoId);
        if (isNaN(parsedPhotoId)) {
          console.error('Invalid photoId:', photoId);
          return;
        }

        const results = await sequelize.query(
          `
          SELECT 
            "PhotoLikes".*,
            json_build_object('username', "Users"."username") AS user
          FROM "PhotoLikes"
          JOIN "Users" ON "PhotoLikes"."userId" = "Users"."id"
          WHERE "PhotoLikes"."photoId" = :parsedPhotoId AND "PhotoLikes"."userId" = :userId
        `,
          {
            replacements: {
              parsedPhotoId,
              userId: parseInt(user.id),
            },
            type: sequelize.QueryTypes.SELECT,
          }
        );
        io.emit('upvote-upload', {
          uploadId: photoId,
          likes: results,
        });
        const photoOwnerId = results?.userId;

        if (photoOwnerId && parseInt(photoOwnerId) !== parseInt(userId)) {
          const notification = await Notification.create({
            userId: photoOwnerId,
            type: 'like',
            content: `Netko je lajkao tvoju fotografiju.`,
            actionId: parsedPhotoId,
            actionType: 'upload',
          });

          if (users.has(photoOwnerId)) {
            users.get(photoOwnerId).sockets.forEach((sockId) => {
              io.to(sockId).emit('new_notification', {
                id: notification.id,
                type: notification.type,
                content: notification.content,
                actionId: notification.actionId,
                actionType: notification.actionType,
                isRead: notification.isRead,
                createdAt: notification.createdAt,
              });
            });
          }
        }
      } catch (error) {
        console.error('🔥 Error in upvote-upload notification:', error);
      }
    });

    socket.on('downvote-upload', async (likeData) => {
      try {
        const { uploadId } = likeData;
        const user = socket.appUser || (await getSocketUser(socket));
        if (!user) {
          console.error('User not found');
          return;
        }

        const photoLike = await PhotoLikes.findOne({
          where: {
            photoId: Number(uploadId),
            userId: user.id,
          },
        });

        if (!photoLike) {
          console.error('PhotoLike not found in downvote');
          return;
        }

        const hasAccess = await socketCanAccess({
          socket,
          model: PhotoLikes,
          resourceId: photoLike.id,
        });
        if (!hasAccess) {
          throw new Error('Forbidden: You cannot dislike this photo.');
        }

        if (!uploadId) {
          console.error('❌ Missing uploadId in downvote-upload');
          return;
        }

        const results = await sequelize.query(
          `
            SELECT 
              "PhotoLikes".*,
              json_build_object('username', "Users"."username") AS user
            FROM "PhotoLikes"
            JOIN "Users" ON "PhotoLikes"."userId" = "Users"."id"
            WHERE "PhotoLikes"."photoId" = :uploadId AND "PhotoLikes"."userId" = :userId
          `,
          {
            replacements: {
              uploadId: parseInt(uploadId),
              userId: parseInt(user.id),
            },
            type: sequelize.QueryTypes.SELECT,
          }
        );

        io.emit('downvote-upload', {
          uploadId,
          likes: results,
        });
      } catch (err) {
        console.error('🔥 Error in downvote-upload:', err);
      }
    });

    socket.on('deleteChat', async ({ chatId }) => {
      try {
        const access = await getSocketChatMembership(socket, chatId);
        if (access.error) {
          console.error('❌ Forbidden deleteChat');
          return;
        }

        const canDelete = await canDeleteChatFromSocket(access);
        if (!canDelete) {
          console.error('❌ Forbidden deleteChat');
          return;
        }

        await emitToChatMembers({
          io,
          chatId: access.chatId,
          event: 'chatDeleted',
          payload: { chatId: access.chatId },
        });
      } catch (error) {
        console.error('🔥 Error in deleteChat:', error);
      }
    });

    socket.on('message', async (message) => {
      try {
        const sender = socket.appUser || (await getSocketUser(socket));
        const chatId = Number(message?.chatId);

        if (!sender || !chatId) {
          socket.emit('message_error', { message: 'Invalid message payload' });
          return;
        }

        const chatMembers = await ChatUser.findAll({
          where: { chatId },
          attributes: ['userId'],
        });
        const memberIds = chatMembers.map(({ userId }) => Number(userId));
        const mentionUserIds = normalizeMentionUserIds(message?.mentions);

        if (!memberIds.includes(sender.id)) {
          socket.emit('message_error', {
            message: 'You do not have access to this chat',
          });
          return;
        }

        if (!mentionUserIds || hasInvalidMentionUserIds(mentionUserIds)) {
          socket.emit('message_error', { message: 'Invalid mentions' });
          return;
        }

        const invalidMentionUserIds = getMentionUserIdsOutsideChat(
          mentionUserIds,
          memberIds
        );

        if (invalidMentionUserIds.length > 0) {
          socket.emit('message_error', {
            message: 'Mentions must be chat members',
          });
          return;
        }

        socket.join(`user:${sender.id}`);
        socket.join(`chat:${chatId}`);
        const sockets = new Set(
          users.get(sender.id)?.sockets || setUsers(sender, socket)
        );
        memberIds.forEach((id) => {
          if (users.has(id)) {
            users.get(id).sockets.forEach((sockId) => sockets.add(sockId));
          }
        });

        // --- 1) Validate referenced image (if any) ---
        let finalMessagePhotoUrl = null;
        try {
          finalMessagePhotoUrl = await resolveMessagePhotoUrl({
            messagePhotoUrl: message.messagePhotoUrl,
            type: message.type,
            userId: sender.id,
          });
        } catch (error) {
          socket.emit('message_rejected', {
            reason: error.message || 'Image rejected. Message not sent.',
            key: message.messagePhotoUrl,
          });
          return;
        }
        // --- 2) Create the message (text-only or with allowed image) ---
        const msgPayload = {
          type: message.type || 'text',
          fromUserId: sender.id,
          chatId,
          message:
            typeof message.message === 'string'
              ? sanitizePlainText(message.message)
              : null,
          messagePhotoUrl: finalMessagePhotoUrl,
        };

        const savedMessage = await Message.create(msgPayload);

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

        // --- 3) Prepare outgoing socket message for clients ---
        const outbound = {
          id: savedMessage.id,
          chatId: savedMessage.chatId,
          fromUserId: sender.id,
          User: sender.toJSON ? sender.toJSON() : sender,
          type: savedMessage.type,
          message: savedMessage.message,
          createdAt: savedMessage.createdAt,
          messagePhotoUrl: finalMessagePhotoUrl,
          securePhotoUrl: finalMessagePhotoUrl
            ? attachSecureUrl(API_BASE_URL, finalMessagePhotoUrl)
            : null,
          reactions: [],
          reactionCount: 0,
          userReactions: [],
          mentionedUsers,
          toUserId: memberIds.filter((id) => id !== sender.id),
        };

        // --- 4) Notify recipients (unchanged) ---
        for (const recipientId of memberIds.filter((id) => id !== sender.id)) {
          if (!recipientId) continue;

          const notification = await Notification.create({
            userId: recipientId,
            type: 'message',
            content: `Nova poruka od ${sender.username || 'someone'}`,
            actionId: savedMessage.chatId,
            actionType: 'message',
            chatId: savedMessage.chatId,
          });

          if (users.has(recipientId)) {
            users.get(recipientId).sockets.forEach((sockId) => {
              io.to(sockId).emit('new_notification', {
                id: notification.id,
                type: notification.type,
                content: notification.content,
                actionId: notification.actionId,
                actionType: notification.actionType,
                isRead: notification.isRead,
                createdAt: notification.createdAt,
                chatId: notification.chatId,
              });
            });
          }
        }

        // --- 5) Broadcast message to all sockets in this convo ---
        sockets.forEach((sockId) => {
          io.to(sockId).emit('received', outbound);
        });
      } catch (e) {
        console.error('❌ Error in socket message handler:', e);
        socket.emit('message_error', { message: 'Failed to send message' });
      }
    });

    socket.on('react-message', async (data = {}, ack) => {
      try {
        const messageId = data.messageId ?? data.id;
        const emoji = validateReactionEmoji(data.emoji);
        if (!emoji) {
          ack?.({ ok: false, error: 'emoji must be an emoji' });
          socket.emit('message_reaction_error', {
            message: 'emoji must be an emoji',
          });
          return;
        }

        const { user, message, error } = await getAccessibleMessageForSocket(
          socket,
          messageId
        );
        if (error) {
          ack?.({ ok: false, error });
          socket.emit('message_reaction_error', { message: error });
          return;
        }

        const existingReaction = await MessageReaction.findOne({
          where: { messageId: message.id, userId: user.id, emoji },
        });

        if (!existingReaction) {
          await MessageReaction.create({
            messageId: message.id,
            userId: user.id,
            emoji,
          });
        }

        const payload = await getMessageReactionPayload({
          message,
          userId: user.id,
          emoji,
          action: 'added',
        });

        io.to(`chat:${message.chatId}`).emit(
          'message-reaction-updated',
          payload
        );
        ack?.({ ok: true, data: payload });
      } catch (error) {
        console.error('❌ Error in react-message handler:', error);
        ack?.({ ok: false, error: 'Failed to react to message' });
        socket.emit('message_reaction_error', {
          message: 'Failed to react to message',
        });
      }
    });

    socket.on('remove-message-reaction', async (data = {}, ack) => {
      try {
        const messageId = data.messageId ?? data.id;
        const emoji = validateReactionEmoji(data.emoji);
        if (!emoji) {
          ack?.({ ok: false, error: 'emoji must be an emoji' });
          socket.emit('message_reaction_error', {
            message: 'emoji must be an emoji',
          });
          return;
        }

        const { user, message, error } = await getAccessibleMessageForSocket(
          socket,
          messageId
        );
        if (error) {
          ack?.({ ok: false, error });
          socket.emit('message_reaction_error', { message: error });
          return;
        }

        const existingReaction = await MessageReaction.findOne({
          where: { messageId: message.id, userId: user.id, emoji },
        });

        if (!existingReaction) {
          ack?.({
            ok: false,
            error: 'You have not reacted to this message with that emoji',
          });
          socket.emit('message_reaction_error', {
            message: 'You have not reacted to this message with that emoji',
          });
          return;
        }

        await existingReaction.destroy();

        const payload = await getMessageReactionPayload({
          message,
          userId: user.id,
          emoji,
          action: 'removed',
        });

        io.to(`chat:${message.chatId}`).emit(
          'message-reaction-updated',
          payload
        );
        ack?.({ ok: true, data: payload });
      } catch (error) {
        console.error('❌ Error in remove-message-reaction handler:', error);
        ack?.({ ok: false, error: 'Failed to remove message reaction' });
        socket.emit('message_reaction_error', {
          message: 'Failed to remove message reaction',
        });
      }
    });

    socket.on('typing', async (data = {}) => {
      try {
        const access = await getSocketChatMembership(socket, data.chatId);
        if (access.error) {
          console.error('❌ Forbidden typing');
          return;
        }

        await emitToChatMembers({
          io,
          chatId: access.chatId,
          event: 'typing',
          payload: { chatId: access.chatId, userId: access.user.id },
          excludeUserIds: [access.user.id],
        });
      } catch (error) {
        console.error('🔥 Error in typing:', error);
      }
    });

    socket.on('stop-typing', async (data = {}) => {
      try {
        const access = await getSocketChatMembership(socket, data.chatId);
        if (access.error) {
          console.error('❌ Forbidden stop-typing');
          return;
        }

        await emitToChatMembers({
          io,
          chatId: access.chatId,
          event: 'stop-typing',
          payload: { chatId: access.chatId, userId: access.user.id },
          excludeUserIds: [access.user.id],
        });
      } catch (error) {
        console.error('🔥 Error in stop-typing:', error);
      }
    });

    socket.on('add-friend', async (data = {}) => {
      try {
        const chatId = data.chatId ?? data?.id ?? data?.[0]?.id;
        const access = await getSocketChatMembership(socket, chatId);
        if (access.error) {
          console.error('❌ Forbidden add-friend');
          return;
        }

        await emitToChatMembers({
          io,
          chatId: access.chatId,
          event: 'new-chat',
          payload: { chatId: access.chatId },
        });
      } catch (error) {
        console.error('🔥 Error in add-friend:', error);
      }
    });

    socket.on('add-user-to-group', async (data = {}) => {
      try {
        const chatId = data.chatId ?? data?.chat?.id;
        const newUserId = parsePositiveInteger(
          data.newUserId ?? data?.newChatter?.id
        );
        const access = await getSocketChatMembership(socket, chatId);

        if (access.error || access.membership.role !== 'admin' || !newUserId) {
          console.error('❌ Forbidden add-user-to-group');
          return;
        }

        const memberIds = await getChatMemberIds(access.chatId);
        if (!memberIds.includes(newUserId)) {
          console.error('❌ New user is not a chat member');
          return;
        }

        await emitToChatMembers({
          io,
          chatId: access.chatId,
          event: 'added-user-to-group',
          payload: { chatId: access.chatId, newUserId },
        });
      } catch (error) {
        console.error('🔥 Error in add-user-to-group:', error);
      }
    });

    socket.on('leave-current-chat', async (data = {}) => {
      try {
        const access = await getSocketChatMembership(socket, data.chatId);
        if (access.error) {
          console.error('❌ Forbidden leave-current-chat');
          return;
        }

        await emitToChatMembers({
          io,
          chatId: access.chatId,
          event: 'remove-user-from-chat',
          payload: {
            chatId: access.chatId,
            userId: access.user.id,
            currentUserId: access.user.id,
          },
          excludeUserIds: [access.user.id],
        });
      } catch (error) {
        console.error('🔥 Error in leave-current-chat:', error);
      }
    });

    socket.on('delete-chat', async (data = {}) => {
      try {
        const access = await getSocketChatMembership(socket, data.chatId);
        if (access.error) {
          console.error('❌ Forbidden delete-chat');
          return;
        }

        const canDelete = await canDeleteChatFromSocket(access);
        if (!canDelete) {
          console.error('❌ Forbidden delete-chat');
          return;
        }

        await emitToChatMembers({
          io,
          chatId: access.chatId,
          event: 'delete-chat',
          payload: access.chatId,
        });
      } catch (error) {
        console.error('🔥 Error in delete-chat:', error);
      }
    });

    socket.on('disconnect', async () => {
      console.log('Client disconnected');
      if (userSockets.has(socket.id)) {
        const user = users.get(userSockets.get(socket.id));
        if (user) {
          untrackSessionSocket(user.id, socket.appSessionId, socket.id);

          if (user.sockets.length > 1) {
            user.sockets = user.sockets.filter((sock) => {
              if (sock !== socket.id) return true;
              userSockets.delete(sock);
              return false;
            });

            users.set(user.id, user);
          } else {
            userSockets.delete(socket.id);
            users.delete(user.id);
            clearPendingOfflineTimer(user.id);
            pendingOfflineTimers.set(
              user.id,
              setTimeout(() => {
                pendingOfflineTimers.delete(user.id);
                if (users.has(user.id)) return;

                getChatters(user.id)
                  .then(async (chatters) => {
                    await User.update(
                      { status: 'offline' },
                      { where: { id: user.id } }
                    );

                    for (let i = 0; i < chatters.length; i++) {
                      if (users.has(chatters[i])) {
                        users.get(chatters[i]).sockets.forEach((socket) => {
                          try {
                            io.to(socket).emit('status-update', {
                              userId: user.id,
                              status: 'offline',
                            });
                          } catch (e) {
                            console.log(e);
                          }
                        });
                      }
                    }
                  })
                  .catch((error) => {
                    console.error('❌ Failed to mark user offline:', error);
                  });
              }, SOCKET_OFFLINE_DELAY_MS)
            );
          }
        }
      }
    });
  });
};

const getChatters = async (userId) => {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return [];
  }

  try {
    const [results] = await sequelize.query(
      `
      select "cu"."userId" from "ChatUsers" as cu
      inner join (
          select "c"."id" from "Chats" as c
          where exists (
              select "u"."id" from "Users" as u
              inner join "ChatUsers" on u.id = "ChatUsers"."userId"
              where u.id = :userId and c.id = "ChatUsers"."chatId"
          )
      ) as cjoin on cjoin.id = "cu"."chatId"
      where "cu"."userId" != :userId
  `,
      { replacements: { userId: parsedUserId } }
    );

    return results.length > 0 ? results.map((el) => el.userId) : [];
  } catch (e) {
    console.log(e);
    return [];
  }
};

const setUsers = (user, socket) => {
  clearPendingOfflineTimer(user.id);
  let sockets = [];
  if (users.has(user.id)) {
    const existingUser = users.get(user.id);
    existingUser.sockets = Array.from(
      new Set([...existingUser.sockets, socket.id])
    );
    existingUser.status = existingUser.status || 'online';
    users.set(user.id, existingUser);
    sockets = existingUser.sockets;
  } else {
    users.set(user.id, {
      id: user.id,
      sockets: [socket.id],
      status: 'online',
    });

    sockets = [socket.id];
  }

  userSockets.set(socket.id, user.id);

  return sockets;
};

module.exports = SocketServer;
