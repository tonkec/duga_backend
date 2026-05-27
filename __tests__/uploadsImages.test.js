process.env.API_JWT_SECRET = 'test-api-secret';
process.env.APP_URL = process.env.APP_URL || 'http://localhost';
process.env.APP_PORT = process.env.APP_PORT || '3000';

const express = require('express');
const request = require('supertest');
const { Op } = require('sequelize');

const mockDetectModerationLabelsPromise = jest
  .fn()
  .mockResolvedValue({ ModerationLabels: [] });
const mockDetectModerationLabels = jest.fn(() => ({
  promise: mockDetectModerationLabelsPromise,
}));

jest.mock('../utils/rekognition', () => ({
  detectModerationLabels: mockDetectModerationLabels,
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
  getObject: jest.fn(() => ({
    promise: jest.fn().mockResolvedValue({ Body: Buffer.from('image') }),
  })),
  deleteObject: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({}) })),
  listObjectsV2: jest.fn(() => ({
    promise: jest.fn().mockResolvedValue({ Contents: [] }),
  })),
  putObject: jest.fn(() => ({ promise: jest.fn().mockResolvedValue({}) })),
}));

jest.mock('../router/uploads/s3/uploadMessageImage', () => {
  return jest.fn(() => (req, res, next) => {
    if (req.headers['x-test-upload-error'] === 'file-type') {
      const error = new Error(
        'Invalid file type. Only PNG, JPG, JPEG, and WEBP are allowed.'
      );
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
        const error = new Error(
          'Invalid file type. Only PNG, JPG, and JPEG are allowed.'
        );
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
            taggedUserIds:
              req.headers['x-test-tagged-users'] === 'true'
                ? ['user-2', 'user-3']
                : [],
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
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
  UploadMention: {
    findAll: jest.fn(),
  },
  PhotoComment: {
    findAll: jest.fn(),
  },
  Message: {
    findAll: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
  },
}));

const {
  Message,
  PhotoComment,
  Upload,
  UploadMention,
  User,
} = require('../models');
const s3 = require('../utils/s3');
const uploadsRouter = require('../router/uploads');
const { signApiToken } = require('../middleware/apiJwt');
const { SESSION_HEADER, hashSessionId } = require('../utils/appSession');

const VALID_SESSION_ID = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFG';

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
  activeSessionIdHash: hashSessionId(VALID_SESSION_ID),
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
    mockDetectModerationLabelsPromise.mockResolvedValue({
      ModerationLabels: [],
    });

    currentUser = buildUser();
    apiToken = signApiToken(currentUser);
    User.findOne.mockResolvedValue(currentUser);
    Message.findAll.mockResolvedValue([]);
    PhotoComment.findAll.mockResolvedValue([]);
    Upload.findAll.mockResolvedValue([]);
    UploadMention.findAll.mockResolvedValue([]);
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
      .set(SESSION_HEADER, VALID_SESSION_ID);

  it('generates upload URL only for authenticated user', async () => {
    Upload.create.mockResolvedValue({ id: 101 });

    const unauthenticatedResponse = await request(app).post(
      '/uploads/message-photos'
    );
    const authenticatedResponse = await authenticated(
      request(app).post('/uploads/message-photos')
    );

    expect(unauthenticatedResponse.status).toBe(401);
    expect(authenticatedResponse.status).toBe(200);
    expect(authenticatedResponse.body.files[0]).toMatchObject({
      id: 101,
      key: 'test/messages/message-photo.jpg',
      secureUrl:
        'http://localhost:3000/uploads/files/test%2Fmessages%2Fmessage-photo.jpg',
      thumbnailUrl:
        'http://localhost:3000/uploads/files/test%2Fmessages%2Fthumbnail-message-photo.jpg',
    });
  });

  it('validates file type', async () => {
    const response = await authenticated(
      request(app).post('/uploads/photos')
    ).set('x-test-upload-error', 'file-type');

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ errors: [{ reason: 'Nepodržan format' }] });
    expect(Upload.create).not.toHaveBeenCalled();
  });

  it('validates file size', async () => {
    const response = await authenticated(
      request(app).post('/uploads/photos')
    ).set('x-test-upload-error', 'file-size');

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      errors: [{ reason: 'Datoteka je veća od 1 MB.' }],
    });
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

  it('tags users from uploaded image descriptions', async () => {
    const setTaggedUsers = jest.fn().mockResolvedValue(undefined);
    Upload.findOne.mockResolvedValue(null);
    Upload.create.mockResolvedValue({ id: 202, setTaggedUsers });

    const response = await authenticated(
      request(app).post('/uploads/photos')
    ).set('x-test-tagged-users', 'true');

    expect(response.status).toBe(200);
    expect(setTaggedUsers).toHaveBeenCalledWith(['user-2', 'user-3']);
  });

  it('checks profile photos with Rekognition before saving metadata', async () => {
    Upload.findOne.mockResolvedValue(null);
    Upload.create.mockResolvedValue({ id: 202 });

    const response = await authenticated(request(app).post('/uploads/photos'));

    expect(response.status).toBe(200);
    expect(s3.headObject).toHaveBeenCalledWith({
      Bucket: 'duga-user-photo',
      Key: 'test/user/user-1/profile.jpg',
    });
    expect(s3.getObject).toHaveBeenCalledWith({
      Bucket: 'duga-user-photo',
      Key: 'test/user/user-1/profile.jpg',
    });
    expect(mockDetectModerationLabels).toHaveBeenCalledWith({
      Image: { Bytes: Buffer.from('moderation-image') },
      MinConfidence: 60,
    });
    expect(Upload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'test/user/user-1/profile.jpg',
        userId: 'user-1',
      })
    );
  });

  it('rejects profile photos blocked by Rekognition', async () => {
    mockDetectModerationLabelsPromise.mockResolvedValueOnce({
      ModerationLabels: [
        { Name: 'Explicit Nudity', ParentName: '', Confidence: 95 },
      ],
    });

    const response = await authenticated(request(app).post('/uploads/photos'));

    expect(response.status).toBe(422);
    expect(response.body.message).toBe(
      'All images were rejected by moderation.'
    );
    expect(Upload.create).not.toHaveBeenCalled();
    expect(s3.deleteObject).toHaveBeenCalledWith({
      Bucket: 'duga-user-photo',
      Key: 'test/user/user-1/profile.jpg',
    });
    expect(s3.deleteObject).toHaveBeenCalledWith({
      Bucket: 'duga-user-photo',
      Key: 'test/user/user-1/thumbnail-profile.jpg',
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

    const response = await authenticated(
      request(app).post('/uploads/photos')
    ).set('x-test-profile-photo', 'true');

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

    const response = await authenticated(
      request(app).post('/uploads/photos')
    ).set('x-test-profile-photo', 'true');

    expect(response.status).toBe(200);
    expect(s3.deleteObject).toHaveBeenCalledWith({
      Bucket: 'duga-user-photo',
      Key: 'test/user/user-1/old-profile.jpg',
    });
    expect(oldProfilePhoto.destroy).toHaveBeenCalledTimes(1);
  });

  it('falls back when user has no image', async () => {
    Upload.findOne.mockResolvedValue(null);

    const response = await authenticated(
      request(app).get('/uploads/profile-photo/user-1')
    );

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

  it('hides inaccessible upload metadata by id', async () => {
    Upload.findOne.mockResolvedValue(null);

    const response = await authenticated(
      request(app).get('/uploads/photo/101')
    );

    expect(response.status).toBe(404);
    expect(Upload.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: '101' }),
      })
    );
  });

  it('scopes arbitrary user upload listings to accessible uploads', async () => {
    Upload.findAll.mockResolvedValue([]);

    const response = await authenticated(
      request(app).get('/uploads/user/user-2')
    );

    expect(response.status).toBe(200);
    expect(Upload.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-2',
          [Op.or]: [{ userId: 'user-1' }],
        }),
      })
    );
  });

  it('scopes latest uploads to accessible uploads', async () => {
    Upload.findAll.mockResolvedValue([]);

    const response = await authenticated(request(app).get('/uploads/latest'));

    expect(response.status).toBe(200);
    expect(Upload.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          [Op.or]: [{ userId: 'user-1' }],
        }),
      })
    );
  });

  it('deletes only records tied to the authorized upload row', async () => {
    const authorizedUpload = {
      id: 301,
      url: 'test/user/user-1/photo.jpg',
      userId: 'user-1',
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const duplicateUpload = {
      id: 302,
      url: 'test/user/user-1/photo.jpg',
      userId: 'user-2',
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const ownedComment = {
      userId: 'user-1',
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const foreignComment = {
      userId: 'user-2',
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const ownedMessage = {
      fromUserId: 'user-1',
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const foreignMessage = {
      fromUserId: 'user-2',
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    Upload.findOne.mockResolvedValue(authorizedUpload);
    Upload.findAll.mockResolvedValue([authorizedUpload, duplicateUpload]);
    PhotoComment.findAll.mockResolvedValue([ownedComment, foreignComment]);
    Message.findAll.mockResolvedValue([ownedMessage, foreignMessage]);

    const response = await authenticated(
      request(app).delete('/uploads/delete-photo')
    ).send({ url: 'test/user/user-1/photo.jpg' });

    expect(response.status).toBe(200);
    expect(Upload.findOne).toHaveBeenCalledWith({
      where: { url: 'test/user/user-1/photo.jpg', userId: 'user-1' },
    });
    expect(authorizedUpload.destroy).toHaveBeenCalledTimes(1);
    expect(ownedComment.setTaggedUsers).toHaveBeenCalledWith([]);
    expect(ownedComment.destroy).toHaveBeenCalledTimes(1);
    expect(ownedMessage.destroy).toHaveBeenCalledTimes(1);
    expect(duplicateUpload.destroy).not.toHaveBeenCalled();
    expect(foreignComment.destroy).not.toHaveBeenCalled();
    expect(foreignMessage.destroy).not.toHaveBeenCalled();
    expect(s3.deleteObject).not.toHaveBeenCalled();
  });

  it('deletes S3 objects only when no other rows reference the key', async () => {
    const authorizedUpload = {
      id: 301,
      url: 'test/user/user-1/photo.jpg',
      userId: 'user-1',
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    Upload.findOne.mockResolvedValue(authorizedUpload);
    Upload.findAll.mockResolvedValue([authorizedUpload]);

    const response = await authenticated(
      request(app).delete('/uploads/delete-photo')
    ).send({ url: 'test/user/user-1/photo.jpg' });

    expect(response.status).toBe(200);
    expect(s3.deleteObject).toHaveBeenCalledWith({
      Bucket: 'duga-user-photo',
      Key: 'test/user/user-1/photo.jpg',
    });
    expect(s3.deleteObject).toHaveBeenCalledWith({
      Bucket: 'duga-user-photo',
      Key: 'test/user/user-1/thumbnail-photo.jpg',
    });
  });
});
