const { Op } = require('sequelize');
const {
  Answer,
  AnswerVote,
  Category,
  Question,
  QuestionVote,
  Upload,
  User,
  sequelize,
} = require('../../models');
const s3 = require('../../utils/s3');
const { attachSecureUrl } = require('../../utils/secureUploadUrl');
const getBearerToken = require('../../utils/getBearerToken');
const { API_BASE_URL } = require('../../consts/apiBaseUrl');
const { BUCKET } = require('../uploads/s3/rekognitionConfiguration');

const USER_ATTRIBUTES = ['id', 'username', 'firstName', 'lastName', 'avatar'];
const questionVoteAttributes = [
  [
    sequelize.literal(
      '(SELECT COALESCE(SUM("value"), 0) FROM "QuestionVotes" WHERE "QuestionVotes"."questionId" = "Question"."id")'
    ),
    'voteScore',
  ],
  [
    sequelize.literal(
      '(SELECT COUNT(*) FROM "QuestionVotes" WHERE "QuestionVotes"."questionId" = "Question"."id")'
    ),
    'voteCount',
  ],
];
const answerVoteAttributes = (answerAlias = 'Answer') => [
  [
    sequelize.literal(
      `(SELECT COALESCE(SUM("value"), 0) FROM "AnswerVotes" WHERE "AnswerVotes"."answerId" = "${answerAlias}"."id")`
    ),
    'voteScore',
  ],
  [
    sequelize.literal(
      `(SELECT COUNT(*) FROM "AnswerVotes" WHERE "AnswerVotes"."answerId" = "${answerAlias}"."id")`
    ),
    'voteCount',
  ],
];
const QUESTION_INCLUDE = [
  { model: User, as: 'user', attributes: USER_ATTRIBUTES },
  { model: Category, as: 'category' },
];
const ANSWER_INCLUDE = [
  { model: User, as: 'user', attributes: USER_ATTRIBUTES },
];
const QUESTION_WITH_ANSWERS_INCLUDE = [
  ...QUESTION_INCLUDE,
  {
    model: Answer,
    as: 'answers',
    attributes: { include: answerVoteAttributes('answers') },
    include: ANSWER_INCLUDE,
  },
];

const getAuthenticatedUserId = (req) => req.user?.id || req.auth?.user?.id;

const hasField = (body, field) =>
  Object.prototype.hasOwnProperty.call(body, field);

const emitForumEvent = (req, event, payload) => {
  const io = req.app.get('io');
  if (io) {
    io.emit(event, payload);
  }
};

const getForumEnv = () => process.env.NODE_ENV || 'development';

const getStoredForumImageKey = (imageUrl) => {
  if (!imageUrl) return null;
  const envPrefix = `${getForumEnv()}/`;
  return imageUrl.startsWith(envPrefix) ? imageUrl : `${envPrefix}${imageUrl}`;
};

const normalizeForumImageUrl = (key) => {
  const envPrefix = `${getForumEnv()}/`;
  return key.startsWith(envPrefix) ? key.slice(envPrefix.length) : key;
};

const serializeForumItem = (item, req) => {
  const plain = item?.toJSON?.() || item;
  if (!plain) return plain;

  if (plain.imageUrl) {
    plain.securePhotoUrl = attachSecureUrl(
      API_BASE_URL,
      getStoredForumImageKey(plain.imageUrl),
      getBearerToken(req)
    );
  }

  if (Array.isArray(plain.answers)) {
    plain.answers = plain.answers.map((answer) =>
      serializeForumItem(answer, req)
    );
  }

  return plain;
};

const persistForumImage = async (req) => {
  if (!req.forumImage) return null;

  const imageUrl = normalizeForumImageUrl(req.forumImage.key);
  await Upload.create({
    url: req.forumImage.key,
    name: req.forumImage.name,
    filetype: req.forumImage.mimetype,
    userId: getAuthenticatedUserId(req),
  });

  return imageUrl;
};

const deleteForumImage = async (imageUrl) => {
  const key = getStoredForumImageKey(imageUrl);
  if (!key) return;

  await s3
    .deleteObject({ Bucket: BUCKET, Key: key })
    .promise()
    .catch(() => {});

  if (Upload?.destroy) {
    await Upload.destroy({ where: { url: key } }).catch(() => {});
  }
};

const deleteQuestionAnswerImages = async (questionId) => {
  const answersWithImages = await Answer.findAll({
    where: {
      questionId,
      imageUrl: { [Op.ne]: null },
    },
    attributes: ['imageUrl'],
  });

  await Promise.all(
    answersWithImages.map((answer) => deleteForumImage(answer.imageUrl))
  );
};

const validateQuestionInput = (body, { partial = false } = {}) => {
  const errors = [];

  if (!partial || hasField(body, 'title')) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push('title is required');
    } else if (body.title.trim().length < 5) {
      errors.push('title must be at least 5 characters');
    } else if (body.title.trim().length > 120) {
      errors.push('title must be 120 characters or less');
    }
  }

  if (!partial || hasField(body, 'body')) {
    if (typeof body.body !== 'string' || body.body.trim().length === 0) {
      errors.push('body is required');
    } else if (body.body.trim().length < 10) {
      errors.push('body must be at least 10 characters');
    }
  }

  if (hasField(body, 'categoryId') && body.categoryId !== null) {
    const categoryId = Number(body.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      errors.push('categoryId must be a positive integer or null');
    }
  }

  if (hasField(body, 'isResolved') && typeof body.isResolved !== 'boolean') {
    errors.push('isResolved must be a boolean');
  }

  return errors;
};

const validateAnswerInput = (body) => {
  if (typeof body.body !== 'string' || body.body.trim().length === 0) {
    return ['body is required'];
  }

  if (body.body.trim().length < 2) {
    return ['body must be at least 2 characters'];
  }

  return [];
};

const normalizeCategoryId = (categoryId) => {
  if (categoryId === undefined) return undefined;
  if (categoryId === null) return null;
  return Number(categoryId);
};

const getQuestionById = (id) =>
  Question.findByPk(id, {
    attributes: { include: questionVoteAttributes },
    include: QUESTION_WITH_ANSWERS_INCLUDE,
    order: [[{ model: Answer, as: 'answers' }, 'createdAt', 'ASC']],
  });

const handleGetQuestions = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const where = {};

    if (req.query.search) {
      const search = `%${req.query.search}%`;
      where[Op.or] = [
        { title: { [Op.iLike]: search } },
        { body: { [Op.iLike]: search } },
      ];
    }

    if (req.query.categoryId) {
      const categoryId = Number(req.query.categoryId);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res
          .status(400)
          .json({ errors: ['categoryId must be a positive integer'] });
      }
      where.categoryId = categoryId;
    }

    const { count, rows } = await Question.findAndCountAll({
      where,
      attributes: { include: questionVoteAttributes },
      include: QUESTION_INCLUDE,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      data: rows.map((question) => serializeForumItem(question, req)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching forum questions:', error);
    return res.status(500).json({ message: 'Error fetching forum questions' });
  }
};

const handleGetQuestionById = async (req, res) => {
  try {
    const question = await getQuestionById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    return res.status(200).json({ data: serializeForumItem(question, req) });
  } catch (error) {
    console.error('Error fetching forum question:', error);
    return res.status(500).json({ message: 'Error fetching forum question' });
  }
};

const handleCreateQuestion = async (req, res) => {
  try {
    const errors = validateQuestionInput(req.body);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const imageUrl = await persistForumImage(req);
    const questionPayload = {
      userId: getAuthenticatedUserId(req),
      title: req.body.title.trim(),
      body: req.body.body.trim(),
      categoryId: normalizeCategoryId(req.body.categoryId) ?? null,
    };
    if (imageUrl) questionPayload.imageUrl = imageUrl;

    const question = await Question.create(questionPayload);
    const fullQuestion = await Question.findByPk(question.id, {
      attributes: { include: questionVoteAttributes },
      include: QUESTION_INCLUDE,
    });
    const data = serializeForumItem(fullQuestion, req);

    emitForumEvent(req, 'forum-question-created', { data });

    return res.status(201).json({ data });
  } catch (error) {
    console.error('Error creating forum question:', error);
    return res.status(500).json({ message: 'Error creating forum question' });
  }
};

const handleUpdateQuestion = async (req, res) => {
  try {
    const errors = validateQuestionInput(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const question = req.resource;
    if (hasField(req.body, 'title')) question.title = req.body.title.trim();
    if (hasField(req.body, 'body')) question.body = req.body.body.trim();
    if (hasField(req.body, 'categoryId')) {
      question.categoryId = normalizeCategoryId(req.body.categoryId);
    }
    if (hasField(req.body, 'isResolved')) {
      question.isResolved = req.body.isResolved;
    }
    if (req.forumImage) {
      await deleteForumImage(question.imageUrl);
      question.imageUrl = await persistForumImage(req);
    }

    await question.save();
    const fullQuestion = await Question.findByPk(question.id, {
      attributes: { include: questionVoteAttributes },
      include: QUESTION_INCLUDE,
    });
    const data = serializeForumItem(fullQuestion, req);

    emitForumEvent(req, 'forum-question-updated', { data });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error updating forum question:', error);
    return res.status(500).json({ message: 'Error updating forum question' });
  }
};

const handleDeleteQuestion = async (req, res) => {
  try {
    const questionId = req.resource.id;
    await deleteQuestionAnswerImages(questionId);
    await deleteForumImage(req.resource.imageUrl);
    await req.resource.destroy();

    emitForumEvent(req, 'forum-question-deleted', {
      data: { id: questionId },
    });

    return res.status(200).json({
      data: { id: questionId },
      message: 'Question deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting forum question:', error);
    return res.status(500).json({ message: 'Error deleting forum question' });
  }
};

const handleDeleteQuestionImage = async (req, res) => {
  try {
    const question = req.resource;
    const imageUrl = question.imageUrl;

    if (!imageUrl) {
      return res.status(400).json({ message: 'Question has no image' });
    }

    question.imageUrl = null;
    await question.save();
    await deleteForumImage(imageUrl);

    const fullQuestion = await Question.findByPk(question.id, {
      attributes: { include: questionVoteAttributes },
      include: QUESTION_INCLUDE,
    });
    const data = serializeForumItem(fullQuestion, req);

    emitForumEvent(req, 'forum-question-updated', { data });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error deleting forum question image:', error);
    return res
      .status(500)
      .json({ message: 'Error deleting forum question image' });
  }
};

const handleCreateAnswer = async (req, res) => {
  try {
    const errors = validateAnswerInput(req.body);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const question = await Question.findByPk(req.params.questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const imageUrl = await persistForumImage(req);
    const answerPayload = {
      questionId: question.id,
      userId: getAuthenticatedUserId(req),
      body: req.body.body.trim(),
    };
    if (imageUrl) answerPayload.imageUrl = imageUrl;

    const answer = await Answer.create(answerPayload);
    const fullAnswer = await Answer.findByPk(answer.id, {
      attributes: { include: answerVoteAttributes() },
      include: ANSWER_INCLUDE,
    });
    const data = serializeForumItem(fullAnswer, req);

    emitForumEvent(req, 'forum-answer-created', {
      data,
      questionId: question.id,
    });

    return res.status(201).json({ data });
  } catch (error) {
    console.error('Error creating forum answer:', error);
    return res.status(500).json({ message: 'Error creating forum answer' });
  }
};

const handleUpdateAnswer = async (req, res) => {
  try {
    const errors = validateAnswerInput(req.body);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const answer = req.resource;
    answer.body = req.body.body.trim();
    if (req.forumImage) {
      await deleteForumImage(answer.imageUrl);
      answer.imageUrl = await persistForumImage(req);
    }
    await answer.save();

    const fullAnswer = await Answer.findByPk(answer.id, {
      attributes: { include: answerVoteAttributes() },
      include: ANSWER_INCLUDE,
    });
    const data = serializeForumItem(fullAnswer, req);

    emitForumEvent(req, 'forum-answer-updated', {
      data,
      questionId: answer.questionId,
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error updating forum answer:', error);
    return res.status(500).json({ message: 'Error updating forum answer' });
  }
};

const handleDeleteAnswer = async (req, res) => {
  try {
    const answerId = req.resource.id;
    const questionId = req.resource.questionId;
    await deleteForumImage(req.resource.imageUrl);
    await req.resource.destroy();

    emitForumEvent(req, 'forum-answer-deleted', {
      data: { id: answerId, questionId },
      questionId,
    });

    return res.status(200).json({
      data: { id: answerId },
      message: 'Answer deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting forum answer:', error);
    return res.status(500).json({ message: 'Error deleting forum answer' });
  }
};

const handleDeleteAnswerImage = async (req, res) => {
  try {
    const answer = req.resource;
    const imageUrl = answer.imageUrl;

    if (!imageUrl) {
      return res.status(400).json({ message: 'Answer has no image' });
    }

    answer.imageUrl = null;
    await answer.save();
    await deleteForumImage(imageUrl);

    const fullAnswer = await Answer.findByPk(answer.id, {
      attributes: { include: answerVoteAttributes() },
      include: ANSWER_INCLUDE,
    });
    const data = serializeForumItem(fullAnswer, req);

    emitForumEvent(req, 'forum-answer-updated', {
      data,
      questionId: answer.questionId,
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error deleting forum answer image:', error);
    return res
      .status(500)
      .json({ message: 'Error deleting forum answer image' });
  }
};

const handleAcceptAnswer = async (req, res) => {
  try {
    const question = await Question.findByPk(req.params.questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    if (question.userId !== getAuthenticatedUserId(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const answer = await Answer.findOne({
      where: {
        id: req.params.answerId,
        questionId: question.id,
      },
    });

    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    await sequelize.transaction(async (transaction) => {
      await Answer.update(
        { isAccepted: false },
        { where: { questionId: question.id }, transaction }
      );
      await answer.update({ isAccepted: true }, { transaction });
      await question.update({ isResolved: true }, { transaction });
    });

    const fullAnswer = await Answer.findByPk(answer.id, {
      attributes: { include: answerVoteAttributes() },
      include: ANSWER_INCLUDE,
    });
    const data = serializeForumItem(fullAnswer, req);

    emitForumEvent(req, 'forum-answer-accepted', {
      data,
      questionId: question.id,
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error accepting forum answer:', error);
    return res.status(500).json({ message: 'Error accepting forum answer' });
  }
};

const validateVoteValue = (value) => {
  const normalizedValue = Number(value);
  if (![1, -1].includes(normalizedValue)) {
    return null;
  }

  return normalizedValue;
};

const getQuestionVoteSummary = async (questionId) => {
  const [voteScore, voteCount] = await Promise.all([
    QuestionVote.sum('value', { where: { questionId } }),
    QuestionVote.count({ where: { questionId } }),
  ]);

  return {
    voteScore: voteScore || 0,
    voteCount,
  };
};

const getAnswerVoteSummary = async (answerId) => {
  const [voteScore, voteCount] = await Promise.all([
    AnswerVote.sum('value', { where: { answerId } }),
    AnswerVote.count({ where: { answerId } }),
  ]);

  return {
    voteScore: voteScore || 0,
    voteCount,
  };
};

const handleVoteQuestion = async (req, res) => {
  try {
    const value = validateVoteValue(req.body.value);
    if (!value) {
      return res.status(400).json({ errors: ['value must be 1 or -1'] });
    }

    const questionId = Number(req.params.id);
    const question = await Question.findByPk(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const userId = getAuthenticatedUserId(req);
    const existingVote = await QuestionVote.findOne({
      where: { questionId, userId },
    });

    if (existingVote) {
      await existingVote.update({ value });
    } else {
      await QuestionVote.create({ questionId, userId, value });
    }

    const summary = await getQuestionVoteSummary(questionId);
    const data = {
      questionId,
      userVote: value,
      ...summary,
    };

    emitForumEvent(req, 'forum-question-vote-updated', { data });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error voting on forum question:', error);
    return res.status(500).json({ message: 'Error voting on forum question' });
  }
};

const handleRemoveQuestionVote = async (req, res) => {
  try {
    const questionId = Number(req.params.id);
    const question = await Question.findByPk(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const userId = getAuthenticatedUserId(req);
    const existingVote = await QuestionVote.findOne({
      where: { questionId, userId },
    });

    if (!existingVote) {
      return res
        .status(400)
        .json({ message: 'You have not voted on this question' });
    }

    await existingVote.destroy();
    const summary = await getQuestionVoteSummary(questionId);
    const data = {
      questionId,
      userVote: null,
      ...summary,
    };

    emitForumEvent(req, 'forum-question-vote-updated', { data });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error removing forum question vote:', error);
    return res
      .status(500)
      .json({ message: 'Error removing forum question vote' });
  }
};

const handleVoteAnswer = async (req, res) => {
  try {
    const value = validateVoteValue(req.body.value);
    if (!value) {
      return res.status(400).json({ errors: ['value must be 1 or -1'] });
    }

    const answerId = Number(req.params.id);
    const answer = await Answer.findByPk(answerId);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    const userId = getAuthenticatedUserId(req);
    const existingVote = await AnswerVote.findOne({
      where: { answerId, userId },
    });

    if (existingVote) {
      await existingVote.update({ value });
    } else {
      await AnswerVote.create({ answerId, userId, value });
    }

    const summary = await getAnswerVoteSummary(answerId);
    const data = {
      answerId,
      userVote: value,
      ...summary,
    };

    emitForumEvent(req, 'forum-answer-vote-updated', {
      data,
      questionId: answer.questionId,
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error voting on forum answer:', error);
    return res.status(500).json({ message: 'Error voting on forum answer' });
  }
};

const handleRemoveAnswerVote = async (req, res) => {
  try {
    const answerId = Number(req.params.id);
    const answer = await Answer.findByPk(answerId);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    const userId = getAuthenticatedUserId(req);
    const existingVote = await AnswerVote.findOne({
      where: { answerId, userId },
    });

    if (!existingVote) {
      return res
        .status(400)
        .json({ message: 'You have not voted on this answer' });
    }

    await existingVote.destroy();
    const summary = await getAnswerVoteSummary(answerId);
    const data = {
      answerId,
      userVote: null,
      ...summary,
    };

    emitForumEvent(req, 'forum-answer-vote-updated', {
      data,
      questionId: answer.questionId,
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error removing forum answer vote:', error);
    return res
      .status(500)
      .json({ message: 'Error removing forum answer vote' });
  }
};

module.exports = {
  handleAcceptAnswer,
  handleCreateAnswer,
  handleCreateQuestion,
  handleDeleteAnswer,
  handleDeleteAnswerImage,
  handleDeleteQuestion,
  handleDeleteQuestionImage,
  handleGetQuestionById,
  handleGetQuestions,
  handleRemoveAnswerVote,
  handleRemoveQuestionVote,
  handleUpdateAnswer,
  handleUpdateQuestion,
  handleVoteAnswer,
  handleVoteQuestion,
};
