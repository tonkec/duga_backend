const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  Answer: {
    create: jest.fn(),
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

const {
  Answer,
  AnswerVote,
  Question,
  QuestionVote,
  sequelize,
} = require('../models');
const forumRouter = require('../router/forum');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/forum', forumRouter);
  return app;
};

const authHeaders = { Authorization: 'Bearer test-token' };

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

    const response = await request(app).get(
      '/forum/questions?page=2&limit=5&search=sequelize&categoryId=3'
    );

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

  it('creates a question for an authenticated user', async () => {
    Question.create.mockResolvedValue({ id: 10 });
    Question.findByPk.mockResolvedValue({
      id: 10,
      userId: 1,
      title: 'How does Sequelize work?',
      body: 'I need help understanding Sequelize associations.',
    });

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

  it('rejects answer updates from non-owners', async () => {
    Answer.findByPk.mockResolvedValue({ id: 22, userId: 2 });

    const response = await request(app)
      .patch('/forum/answers/22')
      .set(authHeaders)
      .send({ body: 'Updated answer' });

    expect(response.status).toBe(403);
  });

  it('creates an answer for an existing question', async () => {
    Question.findByPk.mockResolvedValue({ id: 10 });
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
    Answer.findByPk.mockResolvedValue({ id: 22 });
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
