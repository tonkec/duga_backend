process.env.API_JWT_SECRET = 'test-api-secret';
process.env.APP_URL = process.env.APP_URL || 'http://localhost';
process.env.APP_PORT = process.env.APP_PORT || '3000';

const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  Chat: {},
  ChatUser: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  Message: {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  MessageMention: {
    bulkCreate: jest.fn(),
  },
  MessageReaction: {},
  Notification: {
    create: jest.fn(),
  },
  User: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
}));

const {
  ChatUser,
  Message,
  MessageMention,
  Notification,
  User,
} = require('../models');
const chatsRouter = require('../router/chat');
const messagesRouter = require('../router/messages');
const { signApiToken } = require('../middleware/apiJwt');
const { SESSION_HEADER, hashSessionId } = require('../utils/appSession');

const buildApp = () => {
  const app = express();
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));

  app.use(express.json());
  app.set('io', { emit, to });
  app.use('/chats', chatsRouter);
  app.use('/messages', messagesRouter);

  return app;
};

const buildUser = (overrides = {}) => ({
  id: 1,
  email: 'user-1@example.com',
  auth0Id: 'auth0|user-1',
  username: 'antonija',
  activeSessionIdHash: hashSessionId('session-1'),
  activeSessionStartedAt: new Date('2026-05-23T00:00:00.000Z'),
  ...overrides,
});

describe('message routes', () => {
  let app;
  let currentUser;
  let apiToken;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();

    currentUser = buildUser();
    apiToken = signApiToken(currentUser);
    User.findOne.mockResolvedValue(currentUser);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  const authenticated = (agent) =>
    agent
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, 'session-1');

  it('sends message as chat member', async () => {
    const savedMessage = {
      id: 501,
      chatId: 101,
      fromUserId: 1,
      type: 'text',
      message: 'Hello',
      messagePhotoUrl: null,
    };

    ChatUser.findOne.mockResolvedValue({ chatId: 101, userId: 1 });
    ChatUser.findAll.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
    Notification.create.mockResolvedValue({
      id: 900,
      userId: 2,
      type: 'message',
    });
    Message.create.mockResolvedValue(savedMessage);

    const response = await authenticated(request(app).post('/messages')).send({
      chatId: 101,
      message: 'Hello',
    });

    expect(response.status).toBe(201);
    expect(ChatUser.findOne).toHaveBeenCalledWith({
      where: { chatId: 101, userId: 1 },
    });
    expect(response.body.data).toEqual({ ...savedMessage, mentionedUsers: [] });
  });

  it('rejects message from non-member', async () => {
    ChatUser.findOne.mockResolvedValue(null);

    const response = await authenticated(request(app).post('/messages')).send({
      chatId: 101,
      message: 'Hello',
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'You do not have access to this chat',
    });
    expect(Message.create).not.toHaveBeenCalled();
  });

  it('rejects empty message', async () => {
    const response = await authenticated(request(app).post('/messages')).send({
      chatId: 101,
      message: '   ',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Message cannot be empty' });
    expect(Message.create).not.toHaveBeenCalled();
  });

  it('saves message with correct senderId/chatId', async () => {
    ChatUser.findOne.mockResolvedValue({ chatId: 101, userId: 1 });
    ChatUser.findAll.mockResolvedValue([{ userId: 1 }]);
    Message.create.mockResolvedValue({
      id: 501,
      chatId: 101,
      fromUserId: 1,
      type: 'text',
      message: 'Hello',
      messagePhotoUrl: null,
    });

    const response = await authenticated(request(app).post('/messages')).send({
      chatId: 101,
      message: 'Hello',
    });

    expect(response.status).toBe(201);
    expect(Message.create).toHaveBeenCalledWith({
      chatId: 101,
      fromUserId: 1,
      type: 'text',
      message: 'Hello',
      messagePhotoUrl: null,
    });
  });

  it('saves mentions in one-on-one chat messages', async () => {
    const savedMessage = {
      id: 501,
      chatId: 101,
      fromUserId: 1,
      type: 'text',
      message: 'Hello @duga',
      messagePhotoUrl: null,
    };
    const mentionedUsers = [{ id: 2, username: 'duga', avatar: 'avatar.jpg' }];

    ChatUser.findOne.mockResolvedValue({ chatId: 101, userId: 1 });
    ChatUser.findAll.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
    Message.create.mockResolvedValue(savedMessage);
    MessageMention.bulkCreate.mockResolvedValue([]);
    User.findAll.mockResolvedValue(mentionedUsers);

    const response = await authenticated(request(app).post('/messages')).send({
      chatId: 101,
      message: 'Hello @duga',
      mentions: [2],
    });

    expect(response.status).toBe(201);
    expect(MessageMention.bulkCreate).toHaveBeenCalledWith([
      { messageId: 501, userId: 2 },
    ]);
    expect(response.body.data.mentionedUsers).toEqual(mentionedUsers);
  });

  it('saves mentions in group chat messages', async () => {
    const savedMessage = {
      id: 502,
      chatId: 202,
      fromUserId: 1,
      type: 'text',
      message: 'Hi @duga and @rainbow',
      messagePhotoUrl: null,
    };
    const mentionedUsers = [
      { id: 2, username: 'duga', avatar: 'avatar-2.jpg' },
      { id: 3, username: 'rainbow', avatar: 'avatar-3.jpg' },
    ];

    ChatUser.findOne.mockResolvedValue({ chatId: 202, userId: 1 });
    ChatUser.findAll.mockResolvedValue([
      { userId: 1 },
      { userId: 2 },
      { userId: 3 },
    ]);
    Message.create.mockResolvedValue(savedMessage);
    MessageMention.bulkCreate.mockResolvedValue([]);
    User.findAll.mockResolvedValue(mentionedUsers);

    const response = await authenticated(request(app).post('/messages')).send({
      chatId: 202,
      message: 'Hi @duga and @rainbow',
      mentions: [2, 3],
    });

    expect(response.status).toBe(201);
    expect(MessageMention.bulkCreate).toHaveBeenCalledWith([
      { messageId: 502, userId: 2 },
      { messageId: 502, userId: 3 },
    ]);
    expect(response.body.data.mentionedUsers).toEqual(mentionedUsers);
  });

  it('rejects mentions for users outside the chat', async () => {
    ChatUser.findOne.mockResolvedValue({ chatId: 101, userId: 1 });
    ChatUser.findAll.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);

    const response = await authenticated(request(app).post('/messages')).send({
      chatId: 101,
      message: 'Hello @not-in-chat',
      mentions: [3],
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Mentions must be chat members' });
    expect(Message.create).not.toHaveBeenCalled();
    expect(MessageMention.bulkCreate).not.toHaveBeenCalled();
  });

  it('lists messages for chat', async () => {
    ChatUser.findOne.mockResolvedValue({ chatId: 101, userId: 1 });
    Message.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [
        {
          type: 'text',
          toJSON: () => ({
            id: 501,
            chatId: 101,
            fromUserId: 1,
            message: 'Hello',
            messagePhotoUrl: null,
            reactions: [
              { emoji: '❤️', userId: 1 },
              { emoji: '❤️', userId: 2 },
              { emoji: '👍', userId: 1 },
            ],
          }),
        },
      ],
    });

    const response = await authenticated(
      request(app).get('/chats/messages?id=101')
    );

    expect(response.status).toBe(200);
    expect(response.body.messages).toEqual([
      {
        id: 501,
        chatId: 101,
        fromUserId: 1,
        message: 'Hello',
        messagePhotoUrl: null,
        reactions: [
          { emoji: '❤️', count: 2 },
          { emoji: '👍', count: 1 },
        ],
        reactionCount: 3,
        userReactions: ['❤️', '👍'],
        securePhotoUrl: null,
      },
    ]);
  });

  it('paginates messages', async () => {
    ChatUser.findOne.mockResolvedValue({ chatId: 101, userId: 1 });
    Message.findAndCountAll.mockResolvedValue({ count: 25, rows: [] });

    const response = await authenticated(
      request(app).get('/chats/messages?id=101&page=2')
    );

    expect(response.status).toBe(200);
    expect(Message.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chatId: 101 },
        limit: 10,
        offset: 10,
        order: [['id', 'DESC']],
      })
    );
    expect(response.body.pagination).toEqual({ page: 2, totalPages: 3 });
  });

  it('marks messages as read', async () => {
    const message = {
      id: 501,
      chatId: 101,
      is_read: false,
      save: jest.fn().mockResolvedValue(undefined),
    };

    Message.findOne.mockResolvedValue(message);
    ChatUser.findAll.mockResolvedValue([{ userId: 1 }]);

    const response = await authenticated(
      request(app).post('/messages/read-message')
    ).send({
      id: 501,
    });

    expect(response.status).toBe(200);
    expect(message.is_read).toBe(true);
    expect(message.save).toHaveBeenCalledTimes(1);
  });

  it('deletes message if owner/admin', async () => {
    const message = {
      id: 501,
      chatId: 101,
      fromUserId: 1,
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    Message.findByPk.mockResolvedValue(message);

    const response = await authenticated(request(app).delete('/messages/501'));

    expect(response.status).toBe(200);
    expect(message.destroy).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({ id: 501 });
  });

  it('emits socket event after message creation', async () => {
    const savedMessage = {
      id: 501,
      chatId: 101,
      fromUserId: 1,
      type: 'text',
      message: 'Hello',
      messagePhotoUrl: null,
    };

    ChatUser.findOne.mockResolvedValue({ chatId: 101, userId: 1 });
    ChatUser.findAll.mockResolvedValue([{ userId: 1 }]);
    Message.create.mockResolvedValue(savedMessage);

    const response = await authenticated(request(app).post('/messages')).send({
      chatId: 101,
      message: 'Hello',
    });

    expect(response.status).toBe(201);
    expect(app.get('io').to).toHaveBeenCalledWith('chat:101');
    expect(app.get('io').to().emit).toHaveBeenCalledWith('received', {
      ...savedMessage,
      mentionedUsers: [],
    });
  });
});
