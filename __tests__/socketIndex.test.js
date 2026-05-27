process.env.API_JWT_SECRET = 'test-api-secret';
process.env.AUTH0_DOMAIN = 'auth.example.com';
process.env.AUTH0_AUDIENCE = 'duga-api';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');
const { hashSessionId } = require('../utils/appSession');

const buildApp = () => {
  const settings = {};

  return {
    set: jest.fn((key, value) => {
      settings[key] = value;
    }),
    settings,
  };
};

const buildSocket = ({
  id = 'socket-1',
  token = 'token',
  sessionId = 'session-1',
  appUser = null,
} = {}) => {
  const handlers = {};

  return {
    id,
    appUser,
    appSessionId: sessionId,
    handshake: {
      auth: { token, sessionId },
    },
    handlers,
    join: jest.fn(),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
    }),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
};

const buildUser = (overrides = {}) => ({
  id: 1,
  auth0Id: 'auth0|user-1',
  username: 'antonija',
  activeSessionIdHash: hashSessionId('session-1'),
  toJSON: jest.fn(() => ({ id: 1, username: 'antonija' })),
  ...overrides,
});

const loadSocketServer = () => {
  jest.resetModules();

  const targetEmits = [];
  const targetEmitters = new Map();
  const io = {
    use: jest.fn((handler) => {
      io.middleware = handler;
    }),
    on: jest.fn((event, handler) => {
      if (event === 'connection') {
        io.connectionHandler = handler;
      }
    }),
    emit: jest.fn(),
    to: jest.fn((target) => {
      if (!targetEmitters.has(target)) {
        targetEmitters.set(target, {
          emit: jest.fn((event, payload) => {
            targetEmits.push({ target, event, payload });
          }),
        });
      }

      return targetEmitters.get(target);
    }),
    sockets: {
      sockets: new Map(),
    },
    targetEmits,
  };

  const models = {
    sequelize: {
      query: jest.fn().mockResolvedValue([[], {}]),
      QueryTypes: { SELECT: 'SELECT' },
    },
    Message: {
      create: jest.fn(),
      findByPk: jest.fn(),
    },
    MessageMention: {
      bulkCreate: jest.fn(),
    },
    MessageReaction: {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    },
    User: {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn(),
    },
    PhotoComment: {
      findByPk: jest.fn(),
    },
    ChatUser: {
      findAll: jest.fn().mockResolvedValue([]),
    },
    Notification: {
      create: jest.fn(),
      findByPk: jest.fn(),
    },
    PhotoLikes: {
      findOne: jest.fn(),
    },
    Upload: {
      findOne: jest.fn(),
    },
  };

  jest.doMock('socket.io', () => jest.fn(() => io));
  jest.doMock('jwks-rsa', () =>
    jest.fn(() => ({
      getSigningKey: jest.fn(),
    }))
  );
  jest.doMock('../models', () => models);
  jest.doMock('../utils/secureUploadUrl', () => ({
    attachSecureUrl: jest.fn(
      (baseUrl, key, token) => `${baseUrl}/${key}?token=${token}`
    ),
  }));

  return {
    SocketServer: require('../socket'),
    io,
    models,
  };
};

describe('SocketServer', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.dontMock('socket.io');
    jest.dontMock('jwks-rsa');
    jest.dontMock('../models');
    jest.dontMock('../utils/secureUploadUrl');
    jest.useRealTimers();
  });

  it('rejects socket connections without complete auth data', async () => {
    const { SocketServer, io } = loadSocketServer();
    SocketServer({}, buildApp());

    const missingTokenNext = jest.fn();
    await io.middleware(buildSocket({ token: null }), missingTokenNext);

    expect(missingTokenNext).toHaveBeenCalledWith(expect.any(Error));
    expect(missingTokenNext.mock.calls[0][0].message).toBe('Missing token');

    const missingSessionNext = jest.fn();
    await io.middleware(buildSocket({ sessionId: null }), missingSessionNext);

    expect(missingSessionNext).toHaveBeenCalledWith(expect.any(Error));
    expect(missingSessionNext.mock.calls[0][0].message).toBe(
      'Missing app session'
    );
  });

  it('uses an explicit socket origin allowlist', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const { SocketServer } = loadSocketServer();
    SocketServer({}, buildApp());

    const socketIo = require('socket.io');
    const originCallback = socketIo.mock.calls[0][1].cors.origin;
    const allowedCallback = jest.fn();
    const deniedCallback = jest.fn();

    originCallback('https://app.example.com', allowedCallback);
    originCallback('https://evil.example.com', deniedCallback);

    expect(allowedCallback).toHaveBeenCalledWith(null, true);
    expect(deniedCallback).toHaveBeenCalledWith(expect.any(Error), false);
  });

  it('authenticates HS256 API tokens with an active app session', async () => {
    const { SocketServer, io, models } = loadSocketServer();
    const user = buildUser();
    const token = jwt.sign(
      { sub: user.auth0Id, tokenUse: 'api' },
      process.env.API_JWT_SECRET,
      { algorithm: 'HS256' }
    );
    const socket = buildSocket({ token, sessionId: 'session-1' });
    const next = jest.fn();

    models.User.findOne.mockResolvedValue(user);
    SocketServer({}, buildApp());

    await io.middleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(models.User.findOne).toHaveBeenCalledWith({
      where: { auth0Id: user.auth0Id },
    });
    expect(socket.user).toMatchObject({ sub: user.auth0Id, tokenUse: 'api' });
    expect(socket.appUser).toBe(user);
    expect(socket.appSessionId).toBe('session-1');
  });

  it('revokes sockets for other sessions of the same user', async () => {
    const { SocketServer, io, models } = loadSocketServer();
    const app = buildApp();
    const user = buildUser();
    const oldSocket = buildSocket({
      id: 'socket-old',
      sessionId: 'session-old',
      appUser: user,
    });
    const activeSocket = buildSocket({
      id: 'socket-active',
      sessionId: 'session-active',
      appUser: user,
    });

    models.ChatUser.findAll.mockResolvedValue([]);
    models.sequelize.query.mockResolvedValue([[], {}]);

    SocketServer({}, app);
    io.sockets.sockets.set(oldSocket.id, oldSocket);
    io.sockets.sockets.set(activeSocket.id, activeSocket);

    io.connectionHandler(oldSocket);
    await oldSocket.handlers.join();
    io.connectionHandler(activeSocket);
    await activeSocket.handlers.join();

    app.settings.revokeUserSessionsExcept(user.id, 'session-active');

    expect(io.targetEmits).toContainEqual({
      target: oldSocket.id,
      event: 'session-revoked',
      payload: undefined,
    });
    expect(oldSocket.disconnect).toHaveBeenCalledWith(true);
    expect(activeSocket.disconnect).not.toHaveBeenCalled();
  });

  it('persists online status when a user joins', async () => {
    const { SocketServer, io, models } = loadSocketServer();
    const user = buildUser();
    const socket = buildSocket({ appUser: user });

    models.ChatUser.findAll.mockResolvedValue([]);
    models.sequelize.query.mockResolvedValue([[], {}]);

    SocketServer({}, buildApp());
    io.connectionHandler(socket);
    await socket.handlers.join();

    expect(models.User.update).toHaveBeenCalledWith(
      { status: 'online' },
      { where: { id: user.id } }
    );
  });

  it('persists explicit status changes and acknowledges the socket event', async () => {
    const { SocketServer, io, models } = loadSocketServer();
    const user = buildUser();
    const socket = buildSocket({ appUser: user });
    const ack = jest.fn();

    models.ChatUser.findAll.mockResolvedValue([]);
    models.sequelize.query.mockResolvedValue([[], {}]);

    SocketServer({}, buildApp());
    io.connectionHandler(socket);
    await socket.handlers.join();
    models.User.update.mockClear();
    io.targetEmits.length = 0;

    await socket.handlers['set-status']({ status: 'offline' }, ack);

    expect(models.User.update).toHaveBeenCalledWith(
      { status: 'offline' },
      { where: { id: user.id } }
    );
    expect(io.targetEmits).toContainEqual({
      target: socket.id,
      event: 'status-update',
      payload: { userId: user.id, status: 'offline' },
    });
    expect(ack).toHaveBeenCalledWith({ ok: true, status: 'offline' });
  });

  it('does not persist offline when a user reconnects before the disconnect grace period', async () => {
    jest.useFakeTimers();
    const { SocketServer, io, models } = loadSocketServer();
    const user = buildUser();
    const firstSocket = buildSocket({ id: 'socket-first', appUser: user });
    const secondSocket = buildSocket({ id: 'socket-second', appUser: user });

    models.ChatUser.findAll.mockResolvedValue([]);
    models.sequelize.query.mockResolvedValue([[], {}]);

    SocketServer({}, buildApp());
    io.connectionHandler(firstSocket);
    await firstSocket.handlers.join();
    models.User.update.mockClear();

    await firstSocket.handlers.disconnect();
    expect(models.User.update).not.toHaveBeenCalledWith(
      { status: 'offline' },
      { where: { id: user.id } }
    );

    io.connectionHandler(secondSocket);
    await secondSocket.handlers.join();
    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(models.User.update).not.toHaveBeenCalledWith(
      { status: 'offline' },
      { where: { id: user.id } }
    );
    jest.useRealTimers();
  });

  it('emits receive-comment when an authorized user sends a valid comment event', async () => {
    const { SocketServer, io, models } = loadSocketServer();
    const user = buildUser();
    const socket = buildSocket({
      token: 'event-token',
      appUser: user,
    });
    const comment = {
      id: 101,
      uploadId: 5,
      userId: user.id,
      imageUrl: null,
      toJSON: jest.fn(() => ({
        id: 101,
        uploadId: 5,
        userId: user.id,
        comment: 'Great photo',
        imageUrl: null,
        user: { id: user.id, username: user.username },
        taggedUsers: [],
      })),
    };

    socket.user = { sub: user.auth0Id };
    models.User.findOne.mockResolvedValue(user);
    models.PhotoComment.findByPk.mockResolvedValue(comment);
    models.sequelize.query.mockResolvedValue([{ userId: user.id }]);

    SocketServer({}, buildApp());
    io.connectionHandler(socket);

    await socket.handlers['send-comment']({
      data: {
        id: comment.id,
        uploadId: comment.uploadId,
      },
    });

    expect(io.emit).toHaveBeenCalledWith('receive-comment', {
      data: {
        id: comment.id,
        uploadId: comment.uploadId,
        userId: user.id,
        comment: 'Great photo',
        imageUrl: null,
        user: { id: user.id, username: user.username },
        taggedUsers: [],
        securePhotoUrl: null,
      },
    });
    expect(models.Notification.create).not.toHaveBeenCalled();
  });

  it('emits received message events to chat member sockets', async () => {
    const { SocketServer, io, models } = loadSocketServer();
    const sender = buildUser();
    const recipient = buildUser({
      id: 2,
      auth0Id: 'auth0|user-2',
      username: 'duga',
      toJSON: jest.fn(() => ({ id: 2, username: 'duga' })),
    });
    const senderSocket = buildSocket({
      id: 'socket-sender',
      token: 'message-token',
      appUser: sender,
    });
    const recipientSocket = buildSocket({
      id: 'socket-recipient',
      token: 'message-token',
      appUser: recipient,
    });
    const createdAt = new Date('2026-05-24T10:00:00.000Z');
    const savedMessage = {
      id: 501,
      chatId: 77,
      type: 'text',
      message: 'Hello',
      createdAt,
    };

    models.ChatUser.findAll.mockResolvedValue([
      { chatId: savedMessage.chatId, userId: sender.id },
      { chatId: savedMessage.chatId, userId: recipient.id },
    ]);
    models.Message.create.mockResolvedValue(savedMessage);
    models.Notification.create.mockResolvedValue({
      id: 601,
      type: 'message',
      content: `Nova poruka od ${sender.username}`,
      actionId: savedMessage.chatId,
      actionType: 'message',
      isRead: false,
      createdAt,
      chatId: savedMessage.chatId,
    });
    models.sequelize.query.mockResolvedValue([[], {}]);

    SocketServer({}, buildApp());
    io.connectionHandler(recipientSocket);
    await recipientSocket.handlers.join();
    io.connectionHandler(senderSocket);

    await senderSocket.handlers.message({
      chatId: savedMessage.chatId,
      message: savedMessage.message,
    });

    const expectedOutbound = {
      id: savedMessage.id,
      chatId: savedMessage.chatId,
      fromUserId: sender.id,
      User: { id: sender.id, username: sender.username },
      type: savedMessage.type,
      message: savedMessage.message,
      createdAt,
      messagePhotoUrl: null,
      securePhotoUrl: null,
      reactions: [],
      reactionCount: 0,
      userReactions: [],
      mentionedUsers: [],
      toUserId: [recipient.id],
    };

    expect(models.Message.create).toHaveBeenCalledWith({
      type: 'text',
      fromUserId: sender.id,
      chatId: savedMessage.chatId,
      message: savedMessage.message,
      messagePhotoUrl: null,
    });
    expect(io.targetEmits).toEqual(
      expect.arrayContaining([
        {
          target: senderSocket.id,
          event: 'received',
          payload: expectedOutbound,
        },
        {
          target: recipientSocket.id,
          event: 'received',
          payload: expectedOutbound,
        },
      ])
    );
  });

  it('adds a message reaction and broadcasts the aggregate to the chat room', async () => {
    const { SocketServer, io, models } = loadSocketServer();
    const user = buildUser();
    const socket = buildSocket({ appUser: user });
    const message = {
      id: 501,
      chatId: 77,
      fromUserId: 2,
    };
    const ack = jest.fn();

    models.Message.findByPk.mockResolvedValue(message);
    models.ChatUser.findAll.mockResolvedValue([
      { chatId: message.chatId, userId: user.id },
      { chatId: message.chatId, userId: 2 },
    ]);
    models.MessageReaction.findOne.mockResolvedValue(null);
    models.MessageReaction.create.mockResolvedValue({ id: 1 });
    models.MessageReaction.findAll.mockResolvedValue([
      { emoji: '❤️', userId: user.id },
      { emoji: '❤️', userId: 2 },
      { emoji: '👍', userId: user.id },
    ]);

    SocketServer({}, buildApp());
    io.connectionHandler(socket);

    await socket.handlers['react-message'](
      { messageId: message.id, emoji: '❤️' },
      ack
    );

    const expectedPayload = {
      messageId: message.id,
      chatId: message.chatId,
      userId: user.id,
      emoji: '❤️',
      action: 'added',
      reactions: [
        { emoji: '❤️', count: 2 },
        { emoji: '👍', count: 1 },
      ],
      reactionCount: 3,
    };

    expect(models.MessageReaction.create).toHaveBeenCalledWith({
      messageId: message.id,
      userId: user.id,
      emoji: '❤️',
    });
    expect(io.targetEmits).toContainEqual({
      target: `chat:${message.chatId}`,
      event: 'message-reaction-updated',
      payload: expectedPayload,
    });
    expect(ack).toHaveBeenCalledWith({ ok: true, data: expectedPayload });
  });

  it('removes a message reaction and broadcasts the aggregate to the chat room', async () => {
    const { SocketServer, io, models } = loadSocketServer();
    const user = buildUser();
    const socket = buildSocket({ appUser: user });
    const message = {
      id: 501,
      chatId: 77,
      fromUserId: 2,
    };
    const existingReaction = {
      id: 1,
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const ack = jest.fn();

    models.Message.findByPk.mockResolvedValue(message);
    models.ChatUser.findAll.mockResolvedValue([
      { chatId: message.chatId, userId: user.id },
      { chatId: message.chatId, userId: 2 },
    ]);
    models.MessageReaction.findOne.mockResolvedValue(existingReaction);
    models.MessageReaction.findAll.mockResolvedValue([]);

    SocketServer({}, buildApp());
    io.connectionHandler(socket);

    await socket.handlers['remove-message-reaction'](
      { messageId: message.id, emoji: '👍' },
      ack
    );

    const expectedPayload = {
      messageId: message.id,
      chatId: message.chatId,
      userId: user.id,
      emoji: '👍',
      action: 'removed',
      reactions: [],
      reactionCount: 0,
    };

    expect(existingReaction.destroy).toHaveBeenCalledTimes(1);
    expect(io.targetEmits).toContainEqual({
      target: `chat:${message.chatId}`,
      event: 'message-reaction-updated',
      payload: expectedPayload,
    });
    expect(ack).toHaveBeenCalledWith({ ok: true, data: expectedPayload });
  });

  it('rejects message reactions from users outside the chat', async () => {
    const { SocketServer, io, models } = loadSocketServer();
    const user = buildUser();
    const socket = buildSocket({ appUser: user });
    const ack = jest.fn();

    models.Message.findByPk.mockResolvedValue({ id: 501, chatId: 77 });
    models.ChatUser.findAll.mockResolvedValue([{ chatId: 77, userId: 2 }]);

    SocketServer({}, buildApp());
    io.connectionHandler(socket);

    await socket.handlers['react-message'](
      { messageId: 501, emoji: '👍' },
      ack
    );

    expect(models.MessageReaction.create).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: 'You do not have access to this chat',
    });
    expect(socket.emit).toHaveBeenCalledWith('message_reaction_error', {
      message: 'You do not have access to this chat',
    });
  });

  it('rejects message reactions that are not emoji', async () => {
    const { SocketServer, io, models } = loadSocketServer();
    const user = buildUser();
    const socket = buildSocket({ appUser: user });
    const ack = jest.fn();

    SocketServer({}, buildApp());
    io.connectionHandler(socket);

    await socket.handlers['react-message'](
      { messageId: 501, emoji: 'like' },
      ack
    );

    expect(models.Message.findByPk).not.toHaveBeenCalled();
    expect(models.MessageReaction.create).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: 'emoji must be an emoji',
    });
    expect(socket.emit).toHaveBeenCalledWith('message_reaction_error', {
      message: 'emoji must be an emoji',
    });
  });
});
