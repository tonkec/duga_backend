process.env.API_JWT_SECRET = 'test-api-secret';
process.env.APP_URL = process.env.APP_URL || 'http://localhost';
process.env.APP_PORT = process.env.APP_PORT || '3000';

const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  Chat: {
    create: jest.fn(),
  },
  ChatUser: {
    bulkCreate: jest.fn(),
    findOne: jest.fn(),
  },
  Message: {
    findAndCountAll: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn(),
  },
}));

const { Chat, ChatUser, Message, User, sequelize } = require('../models');
const chatsRouter = require('../router/chat');
const { signApiToken } = require('../middleware/apiJwt');
const { SESSION_HEADER, hashSessionId } = require('../utils/appSession');

const buildApp = () => {
  const app = express();

  app.use(express.json());
  app.use('/chats', chatsRouter);

  return app;
};

const buildUser = (overrides = {}) => ({
  id: 1,
  email: 'user-1@example.com',
  auth0Id: 'auth0|user-1',
  username: 'antonija',
  avatar: 'avatar-1.jpg',
  activeSessionIdHash: hashSessionId('session-1'),
  activeSessionStartedAt: new Date('2026-05-23T00:00:00.000Z'),
  ...overrides,
});

describe('chat routes', () => {
  let app;
  let currentUser;
  let apiToken;
  let transaction;
  let consoleErrorSpy;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();

    currentUser = buildUser();
    apiToken = signApiToken(currentUser);
    transaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    sequelize.transaction.mockResolvedValue(transaction);
    User.findOne.mockImplementation(({ where }) => {
      if (
        where?.auth0Id === currentUser.auth0Id ||
        where?.id === currentUser.id
      ) {
        return Promise.resolve(currentUser);
      }
      return Promise.resolve(null);
    });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const authenticated = (agent) =>
    agent
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, 'session-1');

  it('creates chat between users', async () => {
    const partner = buildUser({
      id: 2,
      auth0Id: 'auth0|user-2',
      username: 'duga',
      avatar: 'avatar-2.jpg',
    });
    const createdChat = { id: 101, type: 'dual' };

    User.findByPk
      .mockResolvedValueOnce(partner)
      .mockResolvedValueOnce(currentUser);
    User.findOne.mockImplementation(({ where }) => {
      if (where?.auth0Id === currentUser.auth0Id)
        return Promise.resolve(currentUser);
      if (where?.id === currentUser.id)
        return Promise.resolve({ ...currentUser, Chats: [] });
      return Promise.resolve(null);
    });
    Chat.create.mockResolvedValue(createdChat);
    ChatUser.bulkCreate.mockResolvedValue([]);

    const response = await authenticated(
      request(app).post('/chats/create')
    ).send({
      partnerId: 2,
    });

    expect(response.status).toBe(200);
    expect(Chat.create).toHaveBeenCalledWith({ type: 'dual' }, { transaction });
    expect(ChatUser.bulkCreate).toHaveBeenCalledWith(
      [
        { chatId: 101, userId: 1 },
        { chatId: 101, userId: 2 },
      ],
      { transaction }
    );
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual([
      {
        id: 101,
        type: 'dual',
        Users: [{ id: 2, username: 'duga', avatar: 'avatar-2.jpg' }],
        Messages: [],
      },
      {
        id: 101,
        type: 'dual',
        Users: [{ id: 1, username: 'antonija', avatar: 'avatar-1.jpg' }],
        Messages: [],
      },
    ]);
  });

  it('prevents duplicate one-on-one chat', async () => {
    const partner = buildUser({ id: 2, auth0Id: 'auth0|user-2' });
    const existingChat = {
      id: 55,
      type: 'dual',
      Users: [{ id: 2, username: 'duga' }],
      Messages: [],
    };

    User.findByPk.mockResolvedValue(partner);
    User.findOne.mockImplementation(({ where }) => {
      if (where?.auth0Id === currentUser.auth0Id)
        return Promise.resolve(currentUser);
      if (where?.id === currentUser.id)
        return Promise.resolve({ ...currentUser, Chats: [existingChat] });
      return Promise.resolve(null);
    });

    const response = await authenticated(
      request(app).post('/chats/create')
    ).send({
      partnerId: 2,
    });

    expect(response.status).toBe(200);
    expect(Chat.create).not.toHaveBeenCalled();
    expect(ChatUser.bulkCreate).not.toHaveBeenCalled();
  });

  it('returns existing chat if already exists', async () => {
    const partner = buildUser({ id: 2, auth0Id: 'auth0|user-2' });
    const existingChat = {
      id: 55,
      type: 'dual',
      Users: [{ id: 2, username: 'duga' }],
      Messages: [],
    };

    User.findByPk.mockResolvedValue(partner);
    User.findOne.mockImplementation(({ where }) => {
      if (where?.auth0Id === currentUser.auth0Id)
        return Promise.resolve(currentUser);
      if (where?.id === currentUser.id)
        return Promise.resolve({ ...currentUser, Chats: [existingChat] });
      return Promise.resolve(null);
    });

    const response = await authenticated(
      request(app).post('/chats/create')
    ).send({
      partnerId: 2,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(existingChat);
  });

  it('lists user’s chats', async () => {
    const chat = {
      id: 101,
      type: 'dual',
      Users: [{ id: 2, username: 'duga' }],
      Messages: [
        {
          toJSON: () => ({
            id: 500,
            chatId: 101,
            message: 'Hi',
            messagePhotoUrl: null,
          }),
        },
      ],
      toJSON: () => ({
        id: 101,
        type: 'dual',
        Users: [{ id: 2, username: 'duga' }],
        Messages: [],
      }),
    };

    User.findOne.mockImplementation(({ where }) => {
      if (where?.auth0Id === currentUser.auth0Id)
        return Promise.resolve(currentUser);
      if (where?.id === currentUser.id)
        return Promise.resolve({ ...currentUser, Chats: [chat] });
      return Promise.resolve(null);
    });

    const response = await authenticated(request(app).get('/chats'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 101,
        type: 'dual',
        Users: [{ id: 2, username: 'duga' }],
        Messages: [
          {
            id: 500,
            chatId: 101,
            message: 'Hi',
            messagePhotoUrl: null,
            securePhotoUrl: null,
          },
        ],
      },
    ]);
  });

  it('only chat members can access chat', async () => {
    ChatUser.findOne.mockResolvedValue(null);

    const response = await authenticated(
      request(app).get('/chats/messages?id=101')
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'You do not have access to this chat',
    });
    expect(Message.findAndCountAll).not.toHaveBeenCalled();
  });

  it('rejects creating chat with invalid user', async () => {
    User.findByPk.mockResolvedValue(null);

    const response = await authenticated(
      request(app).post('/chats/create')
    ).send({
      partnerId: 999,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Partner not found' });
    expect(Chat.create).not.toHaveBeenCalled();
    expect(ChatUser.bulkCreate).not.toHaveBeenCalled();
  });
});
