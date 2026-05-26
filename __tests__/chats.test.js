process.env.API_JWT_SECRET = 'test-api-secret';
process.env.APP_URL = process.env.APP_URL || 'http://localhost';
process.env.APP_PORT = process.env.APP_PORT || '3000';

const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  Chat: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  ChatUser: {
    bulkCreate: jest.fn(),
    destroy: jest.fn(),
    findOne: jest.fn(),
  },
  Message: {
    findAndCountAll: jest.fn(),
  },
  MessageReaction: {},
  User: {
    findAll: jest.fn(),
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

  it('creates group chat between users', async () => {
    const members = [
      buildUser({
        id: 2,
        auth0Id: 'auth0|user-2',
        username: 'duga',
        avatar: 'avatar-2.jpg',
      }),
      buildUser({
        id: 3,
        auth0Id: 'auth0|user-3',
        username: 'rainbow',
        avatar: 'avatar-3.jpg',
      }),
    ];
    const createdChat = { id: 202, type: 'group', name: 'Weekend plans' };

    User.findAll.mockResolvedValue(members);
    Chat.create.mockResolvedValue(createdChat);
    ChatUser.bulkCreate.mockResolvedValue([]);

    const response = await authenticated(
      request(app).post('/chats/create')
    ).send({
      userIds: [2, 3],
      name: 'Weekend plans',
    });

    expect(response.status).toBe(201);
    expect(Chat.create).toHaveBeenCalledWith(
      { type: 'group', name: 'Weekend plans' },
      { transaction }
    );
    expect(ChatUser.bulkCreate).toHaveBeenCalledWith(
      [
        { chatId: 202, userId: 1, role: 'admin' },
        { chatId: 202, userId: 2, role: 'member' },
        { chatId: 202, userId: 3, role: 'member' },
      ],
      { transaction }
    );
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({
      id: 202,
      type: 'group',
      name: 'Weekend plans',
      Users: [
        { id: 2, username: 'duga', avatar: 'avatar-2.jpg' },
        { id: 3, username: 'rainbow', avatar: 'avatar-3.jpg' },
      ],
      Messages: [],
    });
  });

  it('creates group chat from public user IDs', async () => {
    const members = [
      buildUser({
        id: 2,
        publicId: '11111111-1111-4111-8111-111111111111',
        auth0Id: 'auth0|user-2',
        username: 'duga',
        avatar: 'avatar-2.jpg',
      }),
      buildUser({
        id: 3,
        publicId: '22222222-2222-4222-8222-222222222222',
        auth0Id: 'auth0|user-3',
        username: 'rainbow',
        avatar: 'avatar-3.jpg',
      }),
    ];
    const createdChat = { id: 203, type: 'group', name: 'Public group' };

    User.findAll.mockResolvedValueOnce(members).mockResolvedValueOnce(members);
    Chat.create.mockResolvedValue(createdChat);
    ChatUser.bulkCreate.mockResolvedValue([]);

    const response = await authenticated(
      request(app).post('/chats/create')
    ).send({
      userPublicIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
      name: 'Public group',
    });

    expect(response.status).toBe(201);
    expect(ChatUser.bulkCreate).toHaveBeenCalledWith(
      [
        { chatId: 203, userId: 1, role: 'admin' },
        { chatId: 203, userId: 2, role: 'member' },
        { chatId: 203, userId: 3, role: 'member' },
      ],
      { transaction }
    );
    expect(response.body.Users).toEqual([
      {
        id: 2,
        publicId: '11111111-1111-4111-8111-111111111111',
        username: 'duga',
        avatar: 'avatar-2.jpg',
      },
      {
        id: 3,
        publicId: '22222222-2222-4222-8222-222222222222',
        username: 'rainbow',
        avatar: 'avatar-3.jpg',
      },
    ]);
  });

  it('rejects group chat with fewer than two other users', async () => {
    const response = await authenticated(
      request(app).post('/chats/create')
    ).send({
      userIds: [2],
      name: 'Too small',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Group chats require at least two valid userIds',
    });
    expect(Chat.create).not.toHaveBeenCalled();
    expect(ChatUser.bulkCreate).not.toHaveBeenCalled();
  });

  it('rejects group chat with more than fifty total members', async () => {
    const response = await authenticated(
      request(app).post('/chats/create')
    ).send({
      userIds: Array.from({ length: 50 }, (_, index) => index + 2),
      name: 'Too many people',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Group chats can have up to 50 members',
    });
    expect(User.findAll).not.toHaveBeenCalled();
    expect(Chat.create).not.toHaveBeenCalled();
    expect(ChatUser.bulkCreate).not.toHaveBeenCalled();
  });

  it('rejects group chat with unknown users', async () => {
    User.findAll.mockResolvedValue([
      buildUser({ id: 2, auth0Id: 'auth0|user-2' }),
    ]);

    const response = await authenticated(
      request(app).post('/chats/create')
    ).send({
      userIds: [2, 999],
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'One or more users not found' });
    expect(Chat.create).not.toHaveBeenCalled();
    expect(ChatUser.bulkCreate).not.toHaveBeenCalled();
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
            reactions: [
              { emoji: '❤️', userId: 1 },
              { emoji: '❤️', userId: 2 },
            ],
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
            reactions: [{ emoji: '❤️', count: 2 }],
            reactionCount: 2,
            userReactions: ['❤️'],
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

  it('allows a member to leave group chat', async () => {
    Chat.findOne.mockResolvedValue({
      id: 202,
      type: 'group',
      Users: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    ChatUser.findOne.mockResolvedValue({
      chatId: 202,
      userId: 1,
      role: 'member',
    });
    ChatUser.destroy.mockResolvedValue(1);

    const response = await authenticated(request(app).post('/chats/202/leave'));

    expect(response.status).toBe(200);
    expect(ChatUser.destroy).toHaveBeenCalledWith({
      where: { chatId: 202, userId: 1 },
    });
    expect(response.body).toEqual({
      chatId: 202,
      userId: 1,
      notifyUsers: [2, 3],
      newAdminUserId: null,
    });
  });

  it('promotes oldest remaining member when group admin leaves', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    Chat.findOne.mockResolvedValue({
      id: 202,
      type: 'group',
      Users: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    ChatUser.findOne
      .mockResolvedValueOnce({ chatId: 202, userId: 1, role: 'admin' })
      .mockResolvedValueOnce({
        id: 22,
        chatId: 202,
        userId: 2,
        role: 'member',
        update,
      });
    ChatUser.destroy.mockResolvedValue(1);

    const response = await authenticated(request(app).post('/chats/202/leave'));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ role: 'admin' });
    expect(ChatUser.destroy).toHaveBeenCalledWith({
      where: { chatId: 202, userId: 1 },
    });
    expect(response.body).toEqual({
      chatId: 202,
      userId: 1,
      notifyUsers: [2, 3],
      newAdminUserId: 2,
    });
  });

  it('rejects leaving one-on-one chat', async () => {
    Chat.findOne.mockResolvedValue({
      id: 101,
      type: 'dual',
      Users: [{ id: 1 }, { id: 2 }],
    });

    const response = await authenticated(request(app).post('/chats/101/leave'));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Only group chats can be left' });
    expect(ChatUser.destroy).not.toHaveBeenCalled();
  });

  it('rejects leaving group chat when user is not a member', async () => {
    Chat.findOne.mockResolvedValue({
      id: 202,
      type: 'group',
      Users: [{ id: 2 }, { id: 3 }],
    });
    ChatUser.findOne.mockResolvedValue(null);

    const response = await authenticated(request(app).post('/chats/202/leave'));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'You do not have access to this chat',
    });
    expect(ChatUser.destroy).not.toHaveBeenCalled();
  });

  it('allows a group admin to delete group chat', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Chat.findOne.mockResolvedValue({
      id: 202,
      type: 'group',
      Users: [{ id: 1 }, { id: 2 }, { id: 3 }],
      destroy,
    });
    ChatUser.findOne.mockResolvedValue({
      chatId: 202,
      userId: 1,
      role: 'admin',
    });

    const response = await authenticated(request(app).delete('/chats/202'));

    expect(response.status).toBe(200);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({
      chatId: 202,
      notifyUsers: [1, 2, 3],
    });
  });

  it('rejects deleting group chat for regular members', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Chat.findOne.mockResolvedValue({
      id: 202,
      type: 'group',
      Users: [{ id: 1 }, { id: 2 }, { id: 3 }],
      destroy,
    });
    ChatUser.findOne.mockResolvedValue({
      chatId: 202,
      userId: 1,
      role: 'member',
    });

    const response = await authenticated(request(app).delete('/chats/202'));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Only group admins can delete group chats',
    });
    expect(destroy).not.toHaveBeenCalled();
  });

  it('rejects deleting chat when user is not a member', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Chat.findOne.mockResolvedValue({
      id: 202,
      type: 'group',
      Users: [{ id: 2 }, { id: 3 }],
      destroy,
    });
    ChatUser.findOne.mockResolvedValue(null);

    const response = await authenticated(request(app).delete('/chats/202'));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'You do not have access to this chat',
    });
    expect(destroy).not.toHaveBeenCalled();
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
