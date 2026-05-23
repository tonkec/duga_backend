process.env.API_JWT_SECRET = 'test-api-secret';

const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  Notification: {
    create: jest.fn(),
  },
  PhotoLikes: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  Upload: {
    findByPk: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
  },
}));

const { Notification, PhotoLikes, Upload, User } = require('../models');
const likesRouter = require('../router/photolikes');
const { signApiToken } = require('../middleware/apiJwt');
const { SESSION_HEADER, hashSessionId } = require('../utils/appSession');

const buildApp = () => {
  const app = express();

  app.use(express.json());
  app.set('io', { emit: jest.fn() });
  app.use('/likes', likesRouter);

  return app;
};

const buildUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'user-1@example.com',
  auth0Id: 'auth0|user-1',
  activeSessionIdHash: hashSessionId('session-1'),
  activeSessionStartedAt: new Date('2026-05-23T00:00:00.000Z'),
  ...overrides,
});

describe('photo likes routes', () => {
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
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const authenticated = (agent) =>
    agent
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, 'session-1');

  it('likes a user photo', async () => {
    const likes = [
      { id: 1, userId: 'user-1', photoId: 101 },
    ];

    PhotoLikes.findOne.mockResolvedValue(null);
    PhotoLikes.create.mockResolvedValue({ id: 1, userId: 'user-1', photoId: 101 });
    PhotoLikes.findAll.mockResolvedValue(likes);
    Upload.findByPk.mockResolvedValue({ id: 101, userId: 'user-2' });
    Notification.create.mockResolvedValue({ id: 900, userId: 'user-2', type: 'like' });

    const response = await authenticated(request(app).post('/likes/upvote/101'));

    expect(response.status).toBe(201);
    expect(PhotoLikes.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', photoId: 101 },
    });
    expect(PhotoLikes.create).toHaveBeenCalledWith({
      userId: 'user-1',
      photoId: 101,
    });
    expect(response.body).toEqual(likes);
    expect(app.get('io').emit).toHaveBeenCalledWith('upvote-upload', {
      uploadId: 101,
      likes,
    });
  });

  it('prevents duplicate photo likes', async () => {
    PhotoLikes.findOne.mockResolvedValue({ id: 1, userId: 'user-1', photoId: 101 });

    const response = await authenticated(request(app).post('/likes/upvote/101'));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'You already liked this photo' });
    expect(PhotoLikes.create).not.toHaveBeenCalled();
    expect(app.get('io').emit).not.toHaveBeenCalled();
  });

  it('unlikes a user photo', async () => {
    const photoLike = {
      id: 1,
      userId: 'user-1',
      photoId: 101,
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const updatedLikes = [{ id: 2, userId: 'user-2', photoId: 101 }];

    PhotoLikes.findOne.mockResolvedValue(photoLike);
    PhotoLikes.findAll.mockResolvedValue(updatedLikes);

    const response = await authenticated(request(app).post('/likes/downvote/101'));

    expect(response.status).toBe(200);
    expect(PhotoLikes.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', photoId: 101 },
    });
    expect(photoLike.destroy).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({ uploadId: 101 });
    expect(app.get('io').emit).toHaveBeenCalledWith('downvote-upload', {
      uploadId: 101,
      likes: updatedLikes,
    });
  });

  it('rejects unlike when the user has not liked the photo', async () => {
    PhotoLikes.findOne.mockResolvedValue(null);

    const response = await authenticated(request(app).post('/likes/downvote/101'));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'You have not liked this photo' });
    expect(app.get('io').emit).not.toHaveBeenCalled();
  });

  it('returns liked users for a photo', async () => {
    const photoLikes = [
      {
        id: 1,
        userId: 'user-1',
        photoId: '101',
        user: { id: 'user-1', username: 'antonija' },
      },
      {
        id: 2,
        userId: 'user-2',
        photoId: '101',
        user: { id: 'user-2', username: 'duga' },
      },
    ];

    PhotoLikes.findAll.mockResolvedValue(photoLikes);

    const response = await authenticated(request(app).get('/likes/all-likes/101'));

    expect(response.status).toBe(200);
    expect(PhotoLikes.findAll).toHaveBeenCalledWith({
      where: { photoId: '101' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username'],
        },
      ],
    });
    expect(response.body).toEqual(photoLikes);
  });

  it('rejects unauthenticated photo likes', async () => {
    const response = await request(app).post('/likes/upvote/101');

    expect(response.status).toBe(401);
    expect(PhotoLikes.findOne).not.toHaveBeenCalled();
    expect(PhotoLikes.create).not.toHaveBeenCalled();
  });
});
