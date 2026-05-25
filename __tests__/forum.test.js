const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  Answer: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
  AnswerVote: {
    count: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    sum: jest.fn(),
  },
  Category: {},
  Notification: {
    create: jest.fn(),
  },
  Question: {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
  },
  QuestionVote: {
    count: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    sum: jest.fn(),
  },
  Upload: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
  User: {},
  sequelize: {
    literal: jest.fn((sql) => sql),
    transaction: jest.fn((callback) => callback({ id: 'transaction' })),
  },
}));

jest.mock('../middleware/authenticatedAppSession', () => ({
  authenticatedAppSession: [
    (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = Number(req.headers['x-test-user-id'] || 1);
      req.auth = {
        sub: `auth0|user-${userId}`,
        user: {
          id: userId,
          email: `user-${userId}@example.com`,
          auth0Id: `auth0|user-${userId}`,
        },
      };
      req.user = req.auth.user;
      next();
    },
  ],
}));

jest.mock('../middleware/accessCheck', () => {
  return (model) => async (req, res, next) => {
    const resource = await model.findByPk(req.params.id);

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (resource.userId !== req.auth.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.resource = resource;
    next();
  };
});

jest.mock('../router/forum/s3/uploadForumImage', () => (target) => [
  (req, res, next) => {
    if (req.headers['x-test-forum-image'] === target) {
      const env = process.env.NODE_ENV || 'development';
      req.forumImage = {
        key: `${env}/forum/${target}/1/test-image.jpg`,
        name: 'test-image.jpg',
        mimetype: 'image/jpeg',
      };
    }
    next();
  },
]);

jest.mock('../utils/s3', () => ({
  deleteObject: jest.fn(() => ({
    promise: jest.fn().mockResolvedValue(undefined),
  })),
}));

const {
  Answer,
  AnswerVote,
  Notification,
  Question,
  QuestionVote,
  sequelize,
  Upload,
} = require('../models');
const s3 = require('../utils/s3');
const forumRouter = require('../router/forum');

const buildApp = (io) => {
  const app = express();
  if (io) {
    app.set('io', io);
  }
  app.use(express.json());
  app.use('/forum', forumRouter);
  return app;
};

const authHeaders = { Authorization: 'Bearer test-token' };
const buildIoMock = () => ({
  emit: jest.fn(),
  to: jest.fn(function () {
    return this;
  }),
});

describe('forum routes', () => {
  let app;
  let consoleErrorSpy;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation((callback) =>
      callback({ id: 'transaction' })
    );
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('lists questions with pagination', async () => {
    Question.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{ id: 1, title: 'Valid question title' }],
    });

    const response = await request(app)
      .get('/forum/questions?page=2&limit=5&search=sequelize&categoryId=3')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [{ id: 1, title: 'Valid question title' }],
      pagination: { page: 2, limit: 5, total: 1, totalPages: 1 },
    });
    expect(Question.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 5,
        offset: 5,
        where: expect.objectContaining({ categoryId: 3 }),
      })
    );
  });

  it('requires authentication to read questions', async () => {
    const listResponse = await request(app).get('/forum/questions');
    const detailResponse = await request(app).get('/forum/questions/10');

    expect(listResponse.status).toBe(401);
    expect(detailResponse.status).toBe(401);
  });

  it('gets a question with its answers', async () => {
    Question.findByPk.mockResolvedValue({
      id: 10,
      userId: 1,
      title: 'How does Sequelize work?',
      body: 'I need help understanding Sequelize associations.',
      answers: [
        {
          id: 22,
          questionId: 10,
          userId: 2,
          body: 'Use hasMany and belongsTo associations.',
        },
      ],
    });

    const response = await request(app)
      .get('/forum/questions/10')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(Question.findByPk).toHaveBeenCalledWith(
      '10',
      expect.objectContaining({
        include: expect.any(Array),
      })
    );
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: 10,
        answers: [
          expect.objectContaining({
            id: 22,
            body: 'Use hasMany and belongsTo associations.',
          }),
        ],
      })
    );
  });

  it('creates a question for an authenticated user', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    Question.create.mockResolvedValue({ id: 10 });
    const fullQuestion = {
      id: 10,
      userId: 1,
      title: 'How does Sequelize work?',
      body: 'I need help understanding Sequelize associations.',
    };
    Question.findByPk.mockResolvedValue(fullQuestion);

    const response = await request(app)
      .post('/forum/questions')
      .set(authHeaders)
      .send({
        title: 'How does Sequelize work?',
        body: 'I need help understanding Sequelize associations.',
        categoryId: 2,
      });

    expect(response.status).toBe(201);
    expect(Question.create).toHaveBeenCalledWith({
      userId: 1,
      title: 'How does Sequelize work?',
      body: 'I need help understanding Sequelize associations.',
      categoryId: 2,
    });
    expect(response.body.data.id).toBe(10);
    expect(io.emit).toHaveBeenCalledWith('forum-question-created', {
      data: fullQuestion,
    });
  });

  it('validates question input', async () => {
    const response = await request(app)
      .post('/forum/questions')
      .set(authHeaders)
      .send({ title: 'Hey', body: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      'title must be at least 5 characters',
      'body must be at least 10 characters',
    ]);
    expect(Question.create).not.toHaveBeenCalled();
  });

  it('creates a question with a moderated image', async () => {
    Question.create.mockResolvedValue({ id: 11 });
    Question.findByPk.mockResolvedValue({
      id: 11,
      userId: 1,
      title: 'How does image upload work?',
      body: 'I need help understanding image upload moderation.',
      imageUrl: 'forum/question/1/test-image.jpg',
    });
    Upload.create.mockResolvedValue({ id: 99 });

    const response = await request(app)
      .post('/forum/questions')
      .set(authHeaders)
      .set('x-test-forum-image', 'question')
      .send({
        title: 'How does image upload work?',
        body: 'I need help understanding image upload moderation.',
      });

    expect(response.status).toBe(201);
    expect(Upload.create).toHaveBeenCalledWith({
      url: 'test/forum/question/1/test-image.jpg',
      name: 'test-image.jpg',
      filetype: 'image/jpeg',
      userId: 1,
    });
    expect(Question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'forum/question/1/test-image.jpg',
      })
    );
    expect(response.body.data.securePhotoUrl).toContain(
      '/uploads/files/test%2Fforum%2Fquestion%2F1%2Ftest-image.jpg'
    );
  });

  it('updates only questions owned by the authenticated user', async () => {
    const question = {
      id: 10,
      userId: 1,
      title: 'Original title',
      body: 'Original body content',
      save: jest.fn().mockResolvedValue(undefined),
    };
    Question.findByPk.mockResolvedValueOnce(question).mockResolvedValueOnce({
      id: 10,
      userId: 1,
      title: 'Updated forum title',
      body: 'Updated body content',
    });

    const response = await request(app)
      .patch('/forum/questions/10')
      .set(authHeaders)
      .send({
        title: 'Updated forum title',
        body: 'Updated body content',
      });

    expect(response.status).toBe(200);
    expect(question.save).toHaveBeenCalled();
    expect(response.body.data.title).toBe('Updated forum title');
  });

  it('deletes answer images when deleting a question', async () => {
    const question = {
      id: 10,
      userId: 1,
      imageUrl: 'forum/question/1/question-image.jpg',
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    Question.findByPk.mockResolvedValue(question);
    Answer.findAll.mockResolvedValue([
      { imageUrl: 'forum/answer/1/answer-image.jpg' },
      { imageUrl: 'test/forum/answer/1/prefixed-answer-image.jpg' },
    ]);
    Upload.destroy.mockResolvedValue(1);

    const response = await request(app)
      .delete('/forum/questions/10')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(Answer.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ questionId: 10 }),
        attributes: ['imageUrl'],
      })
    );
    expect(s3.deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: 'test/forum/question/1/question-image.jpg',
      })
    );
    expect(s3.deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: 'test/forum/answer/1/answer-image.jpg',
      })
    );
    expect(s3.deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: 'test/forum/answer/1/prefixed-answer-image.jpg',
      })
    );
    expect(Upload.destroy).toHaveBeenCalledWith({
      where: { url: 'test/forum/answer/1/answer-image.jpg' },
    });
    expect(question.destroy).toHaveBeenCalled();
  });

  it('deletes a question image without deleting the question', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    const question = {
      id: 10,
      userId: 1,
      imageUrl: 'forum/question/1/delete-me.jpg',
      save: jest.fn().mockResolvedValue(undefined),
    };
    Question.findByPk.mockResolvedValueOnce(question).mockResolvedValueOnce({
      id: 10,
      userId: 1,
      title: 'Question without image',
      body: 'The image was removed from this question.',
      imageUrl: null,
    });
    Upload.destroy.mockResolvedValue(1);

    const response = await request(app)
      .delete('/forum/questions/10/image')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(question.imageUrl).toBeNull();
    expect(question.save).toHaveBeenCalledTimes(1);
    expect(s3.deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'test/forum/question/1/delete-me.jpg' })
    );
    expect(Upload.destroy).toHaveBeenCalledWith({
      where: { url: 'test/forum/question/1/delete-me.jpg' },
    });
    expect(response.body.data.imageUrl).toBeNull();
    expect(io.emit).toHaveBeenCalledWith('forum-question-updated', {
      data: expect.objectContaining({ id: 10, imageUrl: null }),
    });
  });

  it('rejects answer updates from non-owners', async () => {
    Answer.findByPk.mockResolvedValue({ id: 22, userId: 2 });

    const response = await request(app)
      .patch('/forum/answers/22')
      .set(authHeaders)
      .send({ body: 'Updated answer' });

    expect(response.status).toBe(403);
  });

  it('updates an answer owned by the authenticated user', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    const answer = {
      id: 22,
      questionId: 10,
      userId: 1,
      body: 'Original answer body.',
      save: jest.fn().mockResolvedValue(undefined),
    };
    Answer.findByPk.mockResolvedValueOnce(answer).mockResolvedValueOnce({
      id: 22,
      questionId: 10,
      userId: 1,
      body: 'Updated answer body.',
    });

    const response = await request(app)
      .patch('/forum/answers/22')
      .set(authHeaders)
      .send({ body: 'Updated answer body.' });

    expect(response.status).toBe(200);
    expect(answer.body).toBe('Updated answer body.');
    expect(answer.save).toHaveBeenCalledTimes(1);
    expect(response.body.data.body).toBe('Updated answer body.');
    expect(io.emit).toHaveBeenCalledWith('forum-answer-updated', {
      data: expect.objectContaining({ id: 22, body: 'Updated answer body.' }),
      questionId: 10,
    });
  });

  it('deletes an answer owned by the authenticated user', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    const answer = {
      id: 22,
      questionId: 10,
      userId: 1,
      imageUrl: 'forum/answer/1/delete-me.jpg',
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    Answer.findByPk.mockResolvedValue(answer);
    Upload.destroy.mockResolvedValue(1);

    const response = await request(app)
      .delete('/forum/answers/22')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(s3.deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'test/forum/answer/1/delete-me.jpg' })
    );
    expect(Upload.destroy).toHaveBeenCalledWith({
      where: { url: 'test/forum/answer/1/delete-me.jpg' },
    });
    expect(answer.destroy).toHaveBeenCalledTimes(1);
    expect(io.emit).toHaveBeenCalledWith('forum-answer-deleted', {
      data: { id: 22, questionId: 10 },
      questionId: 10,
    });
  });

  it('deletes an answer image without deleting the answer', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    const answer = {
      id: 22,
      questionId: 10,
      userId: 1,
      imageUrl: 'forum/answer/1/delete-me.jpg',
      save: jest.fn().mockResolvedValue(undefined),
    };
    Answer.findByPk.mockResolvedValueOnce(answer).mockResolvedValueOnce({
      id: 22,
      questionId: 10,
      userId: 1,
      body: 'Answer without image.',
      imageUrl: null,
    });
    Upload.destroy.mockResolvedValue(1);

    const response = await request(app)
      .delete('/forum/answers/22/image')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(answer.imageUrl).toBeNull();
    expect(answer.save).toHaveBeenCalledTimes(1);
    expect(s3.deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'test/forum/answer/1/delete-me.jpg' })
    );
    expect(Upload.destroy).toHaveBeenCalledWith({
      where: { url: 'test/forum/answer/1/delete-me.jpg' },
    });
    expect(response.body.data.imageUrl).toBeNull();
    expect(io.emit).toHaveBeenCalledWith('forum-answer-updated', {
      data: expect.objectContaining({ id: 22, imageUrl: null }),
      questionId: 10,
    });
  });

  it('creates an answer for an existing question', async () => {
    Question.findByPk.mockResolvedValue({ id: 10, userId: 1 });
    Answer.create.mockResolvedValue({ id: 22 });
    Answer.findByPk.mockResolvedValue({
      id: 22,
      questionId: 10,
      userId: 1,
      body: 'Use a belongsTo association.',
    });

    const response = await request(app)
      .post('/forum/questions/10/answers')
      .set(authHeaders)
      .send({ body: 'Use a belongsTo association.' });

    expect(response.status).toBe(201);
    expect(Answer.create).toHaveBeenCalledWith({
      questionId: 10,
      userId: 1,
      body: 'Use a belongsTo association.',
    });
    expect(response.body.data.id).toBe(22);
  });

  it('notifies the question owner when another user answers', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    Question.findByPk.mockResolvedValue({ id: 10, userId: 2 });
    Answer.create.mockResolvedValue({ id: 22 });
    Answer.findByPk.mockResolvedValue({
      id: 22,
      questionId: 10,
      userId: 1,
      body: 'This is a new answer.',
    });
    Notification.create.mockResolvedValue({
      id: 99,
      userId: 2,
      type: 'forum_answer',
      content: 'Netko je odgovorio na tvoje pitanje.',
      actionId: 10,
      actionType: 'forum_question',
      isRead: false,
    });

    const response = await request(app)
      .post('/forum/questions/10/answers')
      .set(authHeaders)
      .send({ body: 'This is a new answer.' });

    expect(response.status).toBe(201);
    expect(Notification.create).toHaveBeenCalledWith({
      userId: 2,
      type: 'forum_answer',
      content: 'Netko je odgovorio na tvoje pitanje.',
      actionId: 10,
      actionType: 'forum_question',
    });
    expect(io.to).toHaveBeenCalledWith('user:2');
    expect(io.emit).toHaveBeenCalledWith(
      'new_notification',
      expect.objectContaining({
        id: 99,
        type: 'forum_answer',
        actionId: 10,
        actionType: 'forum_question',
      })
    );
  });

  it('does not notify when the question owner answers their own question', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    Question.findByPk.mockResolvedValue({ id: 10, userId: 1 });
    Answer.create.mockResolvedValue({ id: 22 });
    Answer.findByPk.mockResolvedValue({
      id: 22,
      questionId: 10,
      userId: 1,
      body: 'Answering my own question.',
    });

    const response = await request(app)
      .post('/forum/questions/10/answers')
      .set(authHeaders)
      .send({ body: 'Answering my own question.' });

    expect(response.status).toBe(201);
    expect(Notification.create).not.toHaveBeenCalled();
    expect(io.to).not.toHaveBeenCalled();
  });

  it('creates an answer with a moderated image', async () => {
    Question.findByPk.mockResolvedValue({ id: 10, userId: 1 });
    Answer.create.mockResolvedValue({ id: 23 });
    Answer.findByPk.mockResolvedValue({
      id: 23,
      questionId: 10,
      userId: 1,
      body: 'Use the image field.',
      imageUrl: 'forum/answer/1/test-image.jpg',
    });
    Upload.create.mockResolvedValue({ id: 100 });

    const response = await request(app)
      .post('/forum/questions/10/answers')
      .set(authHeaders)
      .set('x-test-forum-image', 'answer')
      .send({ body: 'Use the image field.' });

    expect(response.status).toBe(201);
    expect(Upload.create).toHaveBeenCalledWith({
      url: 'test/forum/answer/1/test-image.jpg',
      name: 'test-image.jpg',
      filetype: 'image/jpeg',
      userId: 1,
    });
    expect(Answer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'forum/answer/1/test-image.jpg',
      })
    );
    expect(response.body.data.securePhotoUrl).toContain(
      '/uploads/files/test%2Fforum%2Fanswer%2F1%2Ftest-image.jpg'
    );
  });

  it('accepts an answer only as the question owner', async () => {
    const question = {
      id: 10,
      userId: 1,
      update: jest.fn().mockResolvedValue(undefined),
    };
    const answer = {
      id: 22,
      questionId: 10,
      update: jest.fn().mockResolvedValue(undefined),
    };
    Question.findByPk.mockResolvedValue(question);
    Answer.findOne.mockResolvedValue(answer);
    Answer.update.mockResolvedValue([1]);
    Answer.findByPk.mockResolvedValue({
      id: 22,
      questionId: 10,
      isAccepted: true,
    });

    const response = await request(app)
      .patch('/forum/questions/10/answers/22/accept')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(Answer.update).toHaveBeenCalledWith(
      { isAccepted: false },
      expect.objectContaining({
        where: { questionId: 10 },
        transaction: { id: 'transaction' },
      })
    );
    expect(answer.update).toHaveBeenCalledWith(
      { isAccepted: true },
      { transaction: { id: 'transaction' } }
    );
    expect(question.update).toHaveBeenCalledWith(
      { isResolved: true },
      { transaction: { id: 'transaction' } }
    );
    expect(response.body.data.isAccepted).toBe(true);
  });

  it('sets a question vote for the authenticated user', async () => {
    Question.findByPk.mockResolvedValue({ id: 10 });
    QuestionVote.findOne.mockResolvedValue(null);
    QuestionVote.create.mockResolvedValue({ id: 1 });
    QuestionVote.sum.mockResolvedValue(3);
    QuestionVote.count.mockResolvedValue(5);

    const response = await request(app)
      .post('/forum/questions/10/votes')
      .set(authHeaders)
      .send({ value: 1 });

    expect(response.status).toBe(200);
    expect(QuestionVote.create).toHaveBeenCalledWith({
      questionId: 10,
      userId: 1,
      value: 1,
    });
    expect(response.body.data).toEqual({
      questionId: 10,
      userVote: 1,
      voteScore: 3,
      voteCount: 5,
    });
  });

  it('notifies the question owner when another user upvotes their question', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    Question.findByPk.mockResolvedValue({ id: 10, userId: 2 });
    QuestionVote.findOne.mockResolvedValue(null);
    QuestionVote.create.mockResolvedValue({ id: 1 });
    QuestionVote.sum.mockResolvedValue(1);
    QuestionVote.count.mockResolvedValue(1);
    Notification.create.mockResolvedValue({
      id: 101,
      userId: 2,
      type: 'forum_question_upvote',
      content: 'Netko je upvoteao tvoje pitanje.',
      actionId: 10,
      actionType: 'forum_question',
      isRead: false,
    });

    const response = await request(app)
      .post('/forum/questions/10/votes')
      .set(authHeaders)
      .send({ value: 1 });

    expect(response.status).toBe(200);
    expect(Notification.create).toHaveBeenCalledWith({
      userId: 2,
      type: 'forum_question_upvote',
      content: 'Netko je upvoteao tvoje pitanje.',
      actionId: 10,
      actionType: 'forum_question',
    });
    expect(io.to).toHaveBeenCalledWith('user:2');
    expect(io.emit).toHaveBeenCalledWith(
      'new_notification',
      expect.objectContaining({
        id: 101,
        type: 'forum_question_upvote',
        actionId: 10,
        actionType: 'forum_question',
      })
    );
  });

  it('does not notify when a user upvotes their own question', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    Question.findByPk.mockResolvedValue({ id: 10, userId: 1 });
    QuestionVote.findOne.mockResolvedValue(null);
    QuestionVote.create.mockResolvedValue({ id: 1 });
    QuestionVote.sum.mockResolvedValue(1);
    QuestionVote.count.mockResolvedValue(1);

    const response = await request(app)
      .post('/forum/questions/10/votes')
      .set(authHeaders)
      .send({ value: 1 });

    expect(response.status).toBe(200);
    expect(Notification.create).not.toHaveBeenCalled();
    expect(io.to).not.toHaveBeenCalled();
  });

  it('sets a question downvote for the authenticated user', async () => {
    Question.findByPk.mockResolvedValue({ id: 10 });
    QuestionVote.findOne.mockResolvedValue(null);
    QuestionVote.create.mockResolvedValue({ id: 1 });
    QuestionVote.sum.mockResolvedValue(-1);
    QuestionVote.count.mockResolvedValue(1);

    const response = await request(app)
      .post('/forum/questions/10/votes')
      .set(authHeaders)
      .send({ value: -1 });

    expect(response.status).toBe(200);
    expect(QuestionVote.create).toHaveBeenCalledWith({
      questionId: 10,
      userId: 1,
      value: -1,
    });
    expect(response.body.data).toEqual({
      questionId: 10,
      userVote: -1,
      voteScore: -1,
      voteCount: 1,
    });
  });

  it('updates an existing question vote', async () => {
    const existingVote = {
      id: 1,
      update: jest.fn().mockResolvedValue(undefined),
    };
    Question.findByPk.mockResolvedValue({ id: 10 });
    QuestionVote.findOne.mockResolvedValue(existingVote);
    QuestionVote.sum.mockResolvedValue(-1);
    QuestionVote.count.mockResolvedValue(1);

    const response = await request(app)
      .post('/forum/questions/10/votes')
      .set(authHeaders)
      .send({ value: -1 });

    expect(response.status).toBe(200);
    expect(existingVote.update).toHaveBeenCalledWith({ value: -1 });
    expect(QuestionVote.create).not.toHaveBeenCalled();
    expect(response.body.data.userVote).toBe(-1);
  });

  it('removes a question vote', async () => {
    const existingVote = {
      id: 1,
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    Question.findByPk.mockResolvedValue({ id: 10 });
    QuestionVote.findOne.mockResolvedValue(existingVote);
    QuestionVote.sum.mockResolvedValue(null);
    QuestionVote.count.mockResolvedValue(0);

    const response = await request(app)
      .delete('/forum/questions/10/votes')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(existingVote.destroy).toHaveBeenCalledTimes(1);
    expect(response.body.data).toEqual({
      questionId: 10,
      userVote: null,
      voteScore: 0,
      voteCount: 0,
    });
  });

  it('sets an answer vote for the authenticated user', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    Answer.findByPk.mockResolvedValue({ id: 22, questionId: 10 });
    AnswerVote.findOne.mockResolvedValue(null);
    AnswerVote.create.mockResolvedValue({ id: 1 });
    AnswerVote.sum.mockResolvedValue(2);
    AnswerVote.count.mockResolvedValue(2);

    const response = await request(app)
      .post('/forum/answers/22/votes')
      .set(authHeaders)
      .send({ value: 1 });

    expect(response.status).toBe(200);
    expect(AnswerVote.create).toHaveBeenCalledWith({
      answerId: 22,
      userId: 1,
      value: 1,
    });
    expect(response.body.data).toEqual({
      answerId: 22,
      userVote: 1,
      voteScore: 2,
      voteCount: 2,
    });
    expect(io.emit).toHaveBeenCalledWith('forum-answer-vote-updated', {
      data: {
        answerId: 22,
        userVote: 1,
        voteScore: 2,
        voteCount: 2,
      },
      questionId: 10,
    });
  });

  it('notifies the answer owner when another user upvotes their answer', async () => {
    const io = buildIoMock();
    app = buildApp(io);
    Answer.findByPk.mockResolvedValue({ id: 22, questionId: 10, userId: 2 });
    AnswerVote.findOne.mockResolvedValue(null);
    AnswerVote.create.mockResolvedValue({ id: 1 });
    AnswerVote.sum.mockResolvedValue(1);
    AnswerVote.count.mockResolvedValue(1);
    Notification.create.mockResolvedValue({
      id: 102,
      userId: 2,
      type: 'forum_answer_upvote',
      content: 'Netko je upvoteao tvoj odgovor.',
      actionId: 22,
      actionType: 'forum_answer',
      isRead: false,
    });

    const response = await request(app)
      .post('/forum/answers/22/votes')
      .set(authHeaders)
      .send({ value: 1 });

    expect(response.status).toBe(200);
    expect(Notification.create).toHaveBeenCalledWith({
      userId: 2,
      type: 'forum_answer_upvote',
      content: 'Netko je upvoteao tvoj odgovor.',
      actionId: 22,
      actionType: 'forum_answer',
    });
    expect(io.to).toHaveBeenCalledWith('user:2');
    expect(io.emit).toHaveBeenCalledWith(
      'new_notification',
      expect.objectContaining({
        id: 102,
        type: 'forum_answer_upvote',
        actionId: 22,
        actionType: 'forum_answer',
      })
    );
  });

  it('sets an answer downvote for the authenticated user', async () => {
    Answer.findByPk.mockResolvedValue({ id: 22, questionId: 10 });
    AnswerVote.findOne.mockResolvedValue(null);
    AnswerVote.create.mockResolvedValue({ id: 1 });
    AnswerVote.sum.mockResolvedValue(-1);
    AnswerVote.count.mockResolvedValue(1);

    const response = await request(app)
      .post('/forum/answers/22/votes')
      .set(authHeaders)
      .send({ value: -1 });

    expect(response.status).toBe(200);
    expect(AnswerVote.create).toHaveBeenCalledWith({
      answerId: 22,
      userId: 1,
      value: -1,
    });
    expect(response.body.data).toEqual({
      answerId: 22,
      userVote: -1,
      voteScore: -1,
      voteCount: 1,
    });
  });

  it('updates an existing answer vote', async () => {
    const existingVote = {
      id: 1,
      update: jest.fn().mockResolvedValue(undefined),
    };
    Answer.findByPk.mockResolvedValue({ id: 22, questionId: 10 });
    AnswerVote.findOne.mockResolvedValue(existingVote);
    AnswerVote.sum.mockResolvedValue(-2);
    AnswerVote.count.mockResolvedValue(2);

    const response = await request(app)
      .post('/forum/answers/22/votes')
      .set(authHeaders)
      .send({ value: -1 });

    expect(response.status).toBe(200);
    expect(existingVote.update).toHaveBeenCalledWith({ value: -1 });
    expect(AnswerVote.create).not.toHaveBeenCalled();
    expect(response.body.data).toEqual({
      answerId: 22,
      userVote: -1,
      voteScore: -2,
      voteCount: 2,
    });
  });

  it('removes an answer vote', async () => {
    const existingVote = {
      id: 1,
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    Answer.findByPk.mockResolvedValue({ id: 22, questionId: 10 });
    AnswerVote.findOne.mockResolvedValue(existingVote);
    AnswerVote.sum.mockResolvedValue(null);
    AnswerVote.count.mockResolvedValue(0);

    const response = await request(app)
      .delete('/forum/answers/22/votes')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(existingVote.destroy).toHaveBeenCalledTimes(1);
    expect(response.body.data).toEqual({
      answerId: 22,
      userVote: null,
      voteScore: 0,
      voteCount: 0,
    });
  });

  it('validates vote value', async () => {
    const response = await request(app)
      .post('/forum/questions/10/votes')
      .set(authHeaders)
      .send({ value: 2 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(['value must be 1 or -1']);
    expect(QuestionVote.create).not.toHaveBeenCalled();
  });
});
