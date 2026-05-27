process.env.API_JWT_SECRET = 'test-api-secret';

const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  ChatUser: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  Message: {
    create: jest.fn(),
  },
  Notification: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
  },
  PhotoLikes: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  Upload: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  UploadMention: {
    findAll: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
  },
}));

const {
  ChatUser,
  Message,
  Notification,
  PhotoLikes,
  Upload,
  UploadMention,
  User,
} = require('../models');
const likesRouter = require('../router/photolikes');
const messagesRouter = require('../router/messages');
const notificationsRouter = require('../router/notifications');
const { signApiToken } = require('../middleware/apiJwt');
const { SESSION_HEADER, hashSessionId } = require('../utils/appSession');

const VALID_SESSION_ID = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFG';

const buildApp = () => {
  const app = express();
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));

  app.use(express.json());
  app.set('io', { emit, to });
  app.use('/likes', likesRouter);
  app.use('/messages', messagesRouter);
  app.use('/notifications', notificationsRouter);

  return app;
};

const buildUser = (overrides = {}) => ({
  id: 1,
  email: 'user-1@example.com',
  auth0Id: 'auth0|user-1',
  username: 'antonija',
  activeSessionIdHash: hashSessionId(VALID_SESSION_ID),
  activeSessionStartedAt: new Date('2026-05-23T00:00:00.000Z'),
  ...overrides,
});

describe('notification routes and side effects', () => {
  let app;
  let currentUser;
  let apiToken;
  let consoleErrorSpy;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();

    currentUser = buildUser();
    apiToken = signApiToken(currentUser);
    User.findOne.mockResolvedValue(currentUser);
    UploadMention.findAll.mockResolvedValue([]);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const authenticated = (agent) =>
    agent
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, VALID_SESSION_ID);

  it('creates notification after message', async () => {
    const savedMessage = {
      id: 501,
      chatId: 101,
      fromUserId: 1,
      message: 'Hello',
    };
    const notification = { id: 900, userId: 2, type: 'message', chatId: 101 };

    ChatUser.findOne.mockResolvedValue({ chatId: 101, userId: 1 });
    ChatUser.findAll.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
    Message.create.mockResolvedValue(savedMessage);
    Notification.create.mockResolvedValue(notification);

    const response = await authenticated(request(app).post('/messages')).send({
      chatId: 101,
      message: 'Hello',
    });

    expect(response.status).toBe(201);
    expect(Notification.create).toHaveBeenCalledWith({
      userId: 2,
      type: 'message',
      content: 'Nova poruka.',
      actionId: 501,
      actionType: 'message',
      chatId: 101,
    });
    expect(app.get('io').to).toHaveBeenCalledWith('user:2');
    expect(app.get('io').to().emit).toHaveBeenCalledWith(
      'new_notification',
      notification
    );
  });

  it('creates notification after like', async () => {
    PhotoLikes.findOne.mockResolvedValue(null);
    PhotoLikes.create.mockResolvedValue({ id: 10, userId: 1, photoId: 101 });
    PhotoLikes.findAll.mockResolvedValue([{ id: 10, userId: 1, photoId: 101 }]);
    Upload.findOne.mockResolvedValue({ id: 101, userId: 2 });
    Notification.create.mockResolvedValue({ id: 901, userId: 2, type: 'like' });

    const response = await authenticated(
      request(app).post('/likes/upvote/101')
    );

    expect(response.status).toBe(201);
    expect(Notification.create).toHaveBeenCalledWith({
      userId: 2,
      type: 'like',
      content: 'Netko je lajkao tvoju fotografiju.',
      actionId: 101,
      actionType: 'upload',
    });
  });

  it('does not notify yourself', async () => {
    ChatUser.findOne.mockResolvedValue({ chatId: 101, userId: 1 });
    ChatUser.findAll.mockResolvedValue([{ userId: 1 }]);
    Message.create.mockResolvedValue({
      id: 501,
      chatId: 101,
      fromUserId: 1,
      message: 'Hello',
    });

    const messageResponse = await authenticated(
      request(app).post('/messages')
    ).send({
      chatId: 101,
      message: 'Hello',
    });

    PhotoLikes.findOne.mockResolvedValue(null);
    PhotoLikes.create.mockResolvedValue({ id: 10, userId: 1, photoId: 101 });
    PhotoLikes.findAll.mockResolvedValue([{ id: 10, userId: 1, photoId: 101 }]);
    Upload.findOne.mockResolvedValue({ id: 101, userId: 1 });

    const likeResponse = await authenticated(
      request(app).post('/likes/upvote/101')
    );

    expect(messageResponse.status).toBe(201);
    expect(likeResponse.status).toBe(201);
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it('marks notification as read', async () => {
    const notification = {
      id: 900,
      userId: 1,
      isRead: false,
      save: jest.fn().mockResolvedValue(undefined),
    };

    Notification.findByPk.mockResolvedValue(notification);

    const response = await authenticated(
      request(app).put('/notifications/900/read')
    );

    expect(response.status).toBe(200);
    expect(notification.isRead).toBe(true);
    expect(notification.save).toHaveBeenCalledTimes(1);
  });

  it('lists unread notifications', async () => {
    const notifications = [
      { id: 900, userId: 1, type: 'message', isRead: false },
    ];

    Notification.findAll.mockResolvedValue(notifications);

    const response = await authenticated(
      request(app).get('/notifications?unread=true')
    );

    expect(response.status).toBe(200);
    expect(Notification.findAll).toHaveBeenCalledWith({
      where: { userId: 1, isRead: false },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });
    expect(response.body).toEqual(notifications);
  });

  it('clears notifications by marking all as read', async () => {
    Notification.update.mockResolvedValue([3]);

    const response = await authenticated(
      request(app).put('/notifications/mark-all-read')
    );

    expect(response.status).toBe(200);
    expect(Notification.update).toHaveBeenCalledWith(
      { isRead: true },
      { where: { userId: 1, isRead: false } }
    );
    expect(response.body).toEqual({
      message: 'Marked 3 notifications as read.',
    });
  });

  it('deletes notification', async () => {
    const notification = {
      id: 900,
      userId: 1,
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    Notification.findByPk.mockResolvedValue(notification);

    const response = await authenticated(
      request(app).delete('/notifications/900')
    );

    expect(response.status).toBe(200);
    expect(notification.destroy).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({ id: 900 });
  });
});
