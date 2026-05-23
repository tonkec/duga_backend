process.env.API_JWT_SECRET = 'test-api-secret';
process.env.APP_URL = process.env.APP_URL || 'http://localhost';
process.env.APP_PORT = process.env.APP_PORT || '3000';

const express = require('express');
const request = require('supertest');

jest.mock('aws-sdk', () => ({
  Rekognition: jest.fn(() => ({
    detectModerationLabels: jest.fn(() => ({
      promise: jest.fn().mockResolvedValue({ ModerationLabels: [] }),
    })),
  })),
}));

jest.mock('sharp', () => {
  return jest.fn(() => ({
    rotate: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('moderation-image')),
  }));
});

jest.mock('../utils/s3', () => ({
  headObject: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({}) })),
  getObject: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({ Body: Buffer.from('image') }) })),
  deleteObject: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({}) })),
  putObject: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({}) })),
}));

jest.mock('../router/uploads/s3/uploadMessageImage', () => {
  return jest.fn(() => (req, res, next) => {
    if (req.headers['x-test-upload-error'] === 'file-type') {
      const error = new Error('Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.');
      error.code = 'LIMIT_UNEXPECTED_FILE';
      return next(error);
    }

    if (req.headers['x-test-upload-error'] === 'file-size') {
      const error = new Error('File too large');
      error.code = 'LIMIT_FILE_SIZE';
      return next(error);
    }

    req.files = [
      {
        originalname: 'message-photo.jpg',
        mimetype: 'image/jpeg',
        transforms: [
          { id: 'original', key: 'test/messages/message-photo.jpg' },
          { id: 'thumbnail', key: 'test/messages/thumbnail-message-photo.jpg' },
        ],
      },
    ];
    next();
  });
});

jest.mock('../router/uploads/s3/uploadProfileImages', () => {
  return jest.fn(() => ({
    array: jest.fn(() => (req, res, next) => {
      if (req.headers['x-test-upload-error'] === 'file-type') {
        const error = new Error('Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.');
        error.code = 'LIMIT_UNEXPECTED_FILE';
        return next(error);
      }

      if (req.headers['x-test-upload-error'] === 'file-size') {
        const error = new Error('File too large');
        error.code = 'LIMIT_FILE_SIZE';
        return next(error);
      }

      req.body = {
        ...req.body,
        text: JSON.stringify([
          {
            imageId: 'profile.jpg',
            description: 'New profile image',
            isProfilePhoto: req.headers['x-test-profile-photo'] === 'true',
          },
        ]),
      };
      req.files = [
        {
          originalname: 'profile.jpg',
          mimetype: 'image/jpeg',
          transforms: [
            { id: 'original', key: 'test/user/user-1/profile.jpg' },
            { id: 'thumbnail', key: 'test/user/user-1/thumbnail-profile.jpg' },
          ],
        },
      ];
      next();
    }),
  }));
});

jest.mock('../models', () => ({
  Upload: {
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
  },
}));

const { Upload, User } = require('../models');
const s3 = require('../utils/s3');
const uploadsRouter = require('../router/uploads');
const { signApiToken } = require('../middleware/apiJwt');
const { SESSION_HEADER, hashSessionId } = require('../utils/appSession');

const buildApp = () => {
  const app = express();

  app.use(express.json());
  app.use('/uploads', uploadsRouter);

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

describe('uploads and images routes', () => {
  let app;
  let currentUser;
  let apiToken;
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();

    currentUser = buildUser();
    apiToken = signApiToken(currentUser);
    User.findOne.mockResolvedValue(currentUser);
    Upload.update.mockResolvedValue([1]);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const authenticated = (agent) =>
    agent
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, 'session-1');

  it('generates upload URL only for authenticated user', async () => {
    Upload.create.mockResolvedValue({ id: 101 });

    const unauthenticatedResponse = await request(app).post('/uploads/message-photos');
    const authenticatedResponse = await authenticated(request(app).post('/uploads/message-photos'));

    expect(unauthenticatedResponse.status).toBe(401);
    expect(authenticatedResponse.status).toBe(200);
    expect(authenticatedResponse.body.files[0]).toMatchObject({
      id: 101,
      key: 'test/messages/message-photo.jpg',
      secureUrl: expect.stringContaining('http://localhost:3000/uploads/files/test%2Fmessages%2Fmessage-photo.jpg?access_token='),
      thumbnailUrl: expect.stringContaining('http://localhost:3000/uploads/files/test%2Fmessages%2Fthumbnail-message-photo.jpg?access_token='),
    });
  });

  it('validates file type', async () => {
    const response = await authenticated(request(app).post('/uploads/photos'))
      .set('x-test-upload-error', 'file-type');

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ errors: [{ reason: 'Nepodržan format' }] });
    expect(Upload.create).not.toHaveBeenCalled();
  });

  it('validates file size', async () => {
    const response = await authenticated(request(app).post('/uploads/photos'))
      .set('x-test-upload-error', 'file-size');

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ errors: [{ reason: 'Datoteka je veća od 1 MB.' }] });
    expect(Upload.create).not.toHaveBeenCalled();
  });

  it('saves uploaded image metadata', async () => {
    Upload.findOne.mockResolvedValue(null);
    Upload.create.mockResolvedValue({ id: 202 });

    const response = await authenticated(request(app).post('/uploads/photos'));

    expect(response.status).toBe(200);
    expect(Upload.create).toHaveBeenCalledWith({
      name: 'profile.jpg',
      url: 'test/user/user-1/profile.jpg',
      description: 'New profile image',
      userId: 'user-1',
      isProfilePhoto: false,
    });
  });

  it('replaces profile image', async () => {
    const oldProfilePhoto = {
      id: 201,
      url: 'test/user/user-1/old-profile.jpg',
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    Upload.findOne.mockResolvedValue(oldProfilePhoto);
    Upload.create.mockResolvedValue({ id: 202 });

    const response = await authenticated(request(app).post('/uploads/photos'))
      .set('x-test-profile-photo', 'true');

    expect(response.status).toBe(200);
    expect(Upload.update).toHaveBeenCalledWith(
      { isProfilePhoto: false },
      { where: { userId: 'user-1' } }
    );
    expect(Upload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'test/user/user-1/profile.jpg',
        userId: 'user-1',
        isProfilePhoto: true,
      })
    );
  });

  it('deletes old image if needed', async () => {
    const oldProfilePhoto = {
      id: 201,
      url: 'test/user/user-1/old-profile.jpg',
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    Upload.findOne.mockResolvedValue(oldProfilePhoto);
    Upload.create.mockResolvedValue({ id: 202 });

    const response = await authenticated(request(app).post('/uploads/photos'))
      .set('x-test-profile-photo', 'true');

    expect(response.status).toBe(200);
    expect(s3.deleteObject).toHaveBeenCalledWith({
      Bucket: 'duga-user-photo',
      Key: 'test/user/user-1/old-profile.jpg',
    });
    expect(oldProfilePhoto.destroy).toHaveBeenCalledTimes(1);
  });

  it('falls back when user has no image', async () => {
    Upload.findOne.mockResolvedValue(null);

    const response = await authenticated(request(app).get('/uploads/profile-photo/user-1'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ securePhotoUrl: null });
  });

  it('rejects unauthorized image update', async () => {
    User.findOne.mockImplementation(({ where }) => {
      if (where?.id === 'user-1' && where?.auth0Id === 'auth0|user-1') {
        return Promise.resolve(null);
      }
      return Promise.resolve(currentUser);
    });

    const response = await authenticated(request(app).post('/uploads/photos'));

    expect(response.status).toBe(404);
    expect(Upload.create).not.toHaveBeenCalled();
    expect(s3.deleteObject).not.toHaveBeenCalled();
  });
});
