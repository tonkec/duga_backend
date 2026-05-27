const {
  Answer,
  ChatUser,
  CommentMention,
  Message,
  PhotoComment,
  Question,
  Upload,
  UploadMention,
} = require('../models');

const sameId = (left, right) => String(left) === String(right);

const unique = (values) => [...new Set(values.filter(Boolean))];

const buildKeyCandidates = (key) => {
  const env = process.env.NODE_ENV || 'development';
  const cleanKey = String(key || '').replace(/^\/+/, '');
  const decodedKey = (() => {
    try {
      return decodeURIComponent(cleanKey);
    } catch (error) {
      return cleanKey;
    }
  })();
  const withoutFilesPrefix = decodedKey.replace(/^uploads\/files\//, '');
  const withoutEnv = withoutFilesPrefix.startsWith(`${env}/`)
    ? withoutFilesPrefix.slice(env.length + 1)
    : withoutFilesPrefix;
  const withEnv = withoutFilesPrefix.startsWith(`${env}/`)
    ? withoutFilesPrefix
    : `${env}/${withoutFilesPrefix}`;

  const baseCandidates = unique([
    cleanKey,
    decodedKey,
    withoutFilesPrefix,
    withoutEnv,
    withEnv,
  ]);

  const thumbnailCandidates = baseCandidates.map((candidate) =>
    candidate.replace(/\/thumbnail-([^/]+)$/, '/$1')
  );

  return unique([...baseCandidates, ...thumbnailCandidates]);
};

const getChatIdFromKey = (key) => {
  const env = process.env.NODE_ENV || 'development';
  const prefix = `${env}/chat/`;
  if (!key.startsWith(prefix)) return null;

  const chatId = parseInt(key.split('/')[2], 10);
  return Number.isNaN(chatId) ? null : chatId;
};

const isChatMember = async (userId, chatId) => {
  const membership = await ChatUser.findOne({ where: { chatId, userId } });
  return !!membership;
};

const findOneByAnyKey = async (model, field, candidates) => {
  if (!model?.findOne) return null;
  return model.findOne({ where: { [field]: candidates } });
};

const canAccessUploadRecord = async (userId, upload) => {
  if (!upload) return false;
  if (sameId(upload.userId, userId)) return true;

  if (!upload.id || !UploadMention?.findOne) return false;

  const mention = await UploadMention.findOne({
    where: { uploadId: upload.id, userId },
  });

  return !!mention;
};

const canAccessCommentRecord = async (userId, comment) => {
  if (!comment) return false;
  if (sameId(comment.userId, userId)) return true;

  if (comment.id && CommentMention?.findOne) {
    const mention = await CommentMention.findOne({
      where: { commentId: comment.id, userId },
    });
    if (mention) return true;
  }

  if (!comment.uploadId || !Upload?.findOne) return false;

  const parentUpload = await Upload.findOne({
    where: { id: comment.uploadId },
  });

  return canAccessUploadRecord(userId, parentUpload);
};

const canAccessFileKey = async (userId, key) => {
  if (!userId || !key) return false;

  const candidates = buildKeyCandidates(key);
  const upload = await findOneByAnyKey(Upload, 'url', candidates);

  if (await canAccessUploadRecord(userId, upload)) {
    return true;
  }

  const comment = await findOneByAnyKey(PhotoComment, 'imageUrl', candidates);

  if (await canAccessCommentRecord(userId, comment)) {
    return true;
  }

  const question = await findOneByAnyKey(Question, 'imageUrl', candidates);
  if (question) return true;

  const answer = await findOneByAnyKey(Answer, 'imageUrl', candidates);
  if (answer) return true;

  const message = await findOneByAnyKey(Message, 'messagePhotoUrl', candidates);
  if (message && upload && sameId(upload.userId, message.fromUserId)) {
    return isChatMember(userId, message.chatId);
  }

  const chatIdFromPath = candidates.map(getChatIdFromKey).find(Boolean);
  if (chatIdFromPath) {
    return isChatMember(userId, chatIdFromPath);
  }

  return false;
};

module.exports = canAccessFileKey;
