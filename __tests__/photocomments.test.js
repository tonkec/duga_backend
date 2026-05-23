process.env.APP_URL = process.env.APP_URL || 'http://localhost';
process.env.APP_PORT = process.env.APP_PORT || '3000';

const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  PhotoComment: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Upload: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
  },
}));

jest.mock('../middleware/authenticatedAppSession', () => ({
  authenticatedAppSession: [
    (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.headers['x-test-user-id'] || 'user-1';

      req.auth = {
        sub: `auth0|${userId}`,
        user: {
          id: userId,
          email: `${userId}@example.com`,
          auth0Id: `auth0|${userId}`,
        },
      };
      next();
    },
  ],
}));

jest.mock('../middleware/accessCheck', () => {
  return (model, lookupFn = null) => async (req, res, next) => {
    const resource = lookupFn ? await lookupFn(req) : await model.findByPk(req.params.id);

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (resource.userId && resource.userId !== req.auth.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.resource = resource;
    next();
  };
});

jest.mock('../router/comments/s3/uploadCommentImage', () => ({
  single: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../utils/s3', () => ({
  deleteObject: jest.fn(() => ({
    promise: jest.fn().mockResolvedValue(undefined),
  })),
}));

const { PhotoComment, Upload } = require('../models');
const s3 = require('../utils/s3');
const commentsRouter = require('../router/photocomments');

const buildApp = () => {
  const app = express();

  app.use(express.json());
  app.use('/comments', commentsRouter);

  return app;
};

const authHeaders = { Authorization: 'Bearer test-token' };

describe('photo comments CRUD routes', () => {
  let app;
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('creates comment for authenticated user', async () => {
    const createdComment = {
      id: 101,
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
    };
    const fullComment = {
      toJSON: () => ({
        id: 101,
        userId: 'user-1',
        uploadId: 'upload-1',
        comment: 'Great photo',
        imageUrl: null,
        user: { id: 'user-1', username: 'antonija' },
        taggedUsers: [{ id: 'user-2', username: 'duga' }],
      }),
    };

    Upload.findByPk.mockResolvedValue({ id: 'upload-1' });
    PhotoComment.create.mockResolvedValue(createdComment);
    PhotoComment.findByPk.mockResolvedValue(fullComment);

    const response = await request(app)
      .post('/comments/add-comment')
      .set(authHeaders)
      .send({
        uploadId: 'upload-1',
        comment: 'Great photo',
        taggedUserIds: JSON.stringify(['user-2']),
      });

    expect(response.status).toBe(201);
    expect(PhotoComment.create).toHaveBeenCalledWith({
      userId: 'user-1',
      uploadId: 'upload-1',
      comment: 'Great photo',
      imageUrl: null,
    });
    expect(createdComment.setTaggedUsers).toHaveBeenCalledWith(['user-2']);
    expect(response.body.data).toMatchObject({
      id: 101,
      userId: 'user-1',
      uploadId: 'upload-1',
      comment: 'Great photo',
      securePhotoUrl: null,
    });
  });

  it('requires auth to create a comment', async () => {
    const response = await request(app)
      .post('/comments/add-comment')
      .send({
        uploadId: 'upload-1',
        comment: 'Great photo',
      });

    expect(response.status).toBe(401);
    expect(PhotoComment.create).not.toHaveBeenCalled();
  });

  it('requires valid text/body to create a comment', async () => {
    const response = await request(app)
      .post('/comments/add-comment')
      .set(authHeaders)
      .send({ uploadId: 'upload-1' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: 'comment is required' });
    expect(PhotoComment.create).not.toHaveBeenCalled();
  });

  it('requires existing post/profile/entity to create a comment', async () => {
    Upload.findByPk.mockResolvedValue(null);

    const response = await request(app)
      .post('/comments/add-comment')
      .set(authHeaders)
      .send({
        uploadId: 'missing-upload',
        comment: 'Great photo',
      });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ message: 'Upload not found' });
    expect(PhotoComment.create).not.toHaveBeenCalled();
  });

  it('stores correct userId as author', async () => {
    const createdComment = {
      id: 102,
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
    };
    const fullComment = {
      toJSON: () => ({
        id: 102,
        userId: 'user-1',
        uploadId: 'upload-1',
        comment: 'Authored by current user',
        imageUrl: null,
        user: { id: 'user-1', username: 'antonija' },
        taggedUsers: [],
      }),
    };

    Upload.findByPk.mockResolvedValue({ id: 'upload-1' });
    PhotoComment.create.mockResolvedValue(createdComment);
    PhotoComment.findByPk.mockResolvedValue(fullComment);

    const response = await request(app)
      .post('/comments/add-comment')
      .set(authHeaders)
      .send({
        uploadId: 'upload-1',
        comment: 'Authored by current user',
      });

    expect(response.status).toBe(201);
    expect(PhotoComment.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' })
    );
    expect(response.body.data.userId).toBe('user-1');
  });

  it('does not allow empty comment', async () => {
    const response = await request(app)
      .post('/comments/add-comment')
      .set(authHeaders)
      .send({
        uploadId: 'upload-1',
        comment: '   ',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: 'comment is required' });
    expect(PhotoComment.create).not.toHaveBeenCalled();
  });

  it('creates mentions if @users are tagged', async () => {
    const createdComment = {
      id: 103,
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
    };
    const fullComment = {
      toJSON: () => ({
        id: 103,
        userId: 'user-1',
        uploadId: 'upload-1',
        comment: 'Hi @duga',
        imageUrl: null,
        user: { id: 'user-1', username: 'antonija' },
        taggedUsers: [{ id: 'user-2', username: 'duga' }],
      }),
    };

    Upload.findByPk.mockResolvedValue({ id: 'upload-1' });
    PhotoComment.create.mockResolvedValue(createdComment);
    PhotoComment.findByPk.mockResolvedValue(fullComment);

    const response = await request(app)
      .post('/comments/add-comment')
      .set(authHeaders)
      .send({
        uploadId: 'upload-1',
        comment: 'Hi @duga',
        taggedUserIds: JSON.stringify(['user-2']),
      });

    expect(response.status).toBe(201);
    expect(createdComment.setTaggedUsers).toHaveBeenCalledWith(['user-2']);
    expect(response.body.data.taggedUsers).toEqual([{ id: 'user-2', username: 'duga' }]);
  });

  it('returns created comment with author data', async () => {
    const createdComment = {
      id: 104,
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
    };
    const fullComment = {
      toJSON: () => ({
        id: 104,
        userId: 'user-1',
        uploadId: 'upload-1',
        comment: 'With author',
        imageUrl: null,
        user: { id: 'user-1', username: 'antonija' },
        taggedUsers: [],
      }),
    };

    Upload.findByPk.mockResolvedValue({ id: 'upload-1' });
    PhotoComment.create.mockResolvedValue(createdComment);
    PhotoComment.findByPk.mockResolvedValue(fullComment);

    const response = await request(app)
      .post('/comments/add-comment')
      .set(authHeaders)
      .send({
        uploadId: 'upload-1',
        comment: 'With author',
      });

    expect(response.status).toBe(201);
    expect(PhotoComment.findByPk).toHaveBeenCalledWith(
      104,
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({
            as: 'user',
            attributes: ['id', 'username'],
          }),
        ]),
      })
    );
    expect(response.body.data).toMatchObject({
      id: 104,
      comment: 'With author',
      user: { id: 'user-1', username: 'antonija' },
    });
  });

  it('returns comments for specific post/profile', async () => {
    Upload.findByPk.mockResolvedValue({ id: 'upload-1' });
    PhotoComment.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          id: 202,
          uploadId: 'upload-1',
          comment: 'Newest',
          imageUrl: 'comment/photo.jpg',
        }),
      },
      {
        toJSON: () => ({
          id: 201,
          uploadId: 'upload-1',
          comment: 'Older',
          imageUrl: null,
        }),
      },
    ]);

    const response = await request(app)
      .get('/comments/get-comments/upload-1')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(Upload.findByPk).toHaveBeenCalledWith('upload-1');
    expect(PhotoComment.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { uploadId: 'upload-1' },
        order: [['createdAt', 'DESC']],
      })
    );
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toMatchObject({
      id: 202,
      comment: 'Newest',
      securePhotoUrl: 'http://localhost:3000/uploads/files/comment%2Fphoto.jpg?access_token=test-token',
    });
    expect(response.body[1]).toMatchObject({
      id: 201,
      comment: 'Older',
      securePhotoUrl: null,
    });
  });

  it('returns author info when reading comments', async () => {
    Upload.findByPk.mockResolvedValue({ id: 'upload-1' });
    PhotoComment.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          id: 203,
          uploadId: 'upload-1',
          comment: 'With author',
          imageUrl: null,
          user: { id: 'user-1', username: 'antonija' },
        }),
      },
    ]);

    const response = await request(app)
      .get('/comments/get-comments/upload-1')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(PhotoComment.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({
            as: 'user',
            attributes: ['id', 'username'],
          }),
        ]),
      })
    );
    expect(response.body[0]).toMatchObject({
      id: 203,
      user: { id: 'user-1', username: 'antonija' },
    });
  });

  it('supports pagination when reading comments', async () => {
    Upload.findByPk.mockResolvedValue({ id: 'upload-1' });
    PhotoComment.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get('/comments/get-comments/upload-1?page=3&limit=10')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(PhotoComment.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 20,
      })
    );
  });

  it('sorts newest/oldest correctly when reading comments', async () => {
    Upload.findByPk.mockResolvedValue({ id: 'upload-1' });
    PhotoComment.findAll.mockResolvedValue([]);

    const newestResponse = await request(app)
      .get('/comments/get-comments/upload-1?sort=newest')
      .set(authHeaders);
    const oldestResponse = await request(app)
      .get('/comments/get-comments/upload-1?sort=oldest')
      .set(authHeaders);

    expect(newestResponse.status).toBe(200);
    expect(oldestResponse.status).toBe(200);
    expect(PhotoComment.findAll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ order: [['createdAt', 'DESC']] })
    );
    expect(PhotoComment.findAll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ order: [['createdAt', 'ASC']] })
    );
  });

  it('returns empty array if no comments', async () => {
    Upload.findByPk.mockResolvedValue({ id: 'upload-1' });
    PhotoComment.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get('/comments/get-comments/upload-1')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns 404 if parent entity does not exist when reading comments', async () => {
    Upload.findByPk.mockResolvedValue(null);

    const response = await request(app)
      .get('/comments/get-comments/missing-upload')
      .set(authHeaders);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ message: 'Upload not found' });
    expect(PhotoComment.findAll).not.toHaveBeenCalled();
  });

  it('allows owner to update comment', async () => {
    const existingComment = {
      id: 303,
      userId: 'user-1',
      comment: 'Before',
      save: jest.fn().mockResolvedValue(undefined),
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
    };
    const updatedComment = {
      id: 303,
      userId: 'user-1',
      comment: 'After',
      taggedUsers: [{ id: 'user-2' }],
    };

    PhotoComment.findByPk
      .mockResolvedValueOnce(existingComment)
      .mockResolvedValueOnce(updatedComment);

    const response = await request(app)
      .put('/comments/update-comment/303')
      .set(authHeaders)
      .send({
        comment: 'After',
        taggedUserIds: ['user-2'],
      });

    expect(response.status).toBe(200);
    expect(existingComment.comment).toBe('After');
    expect(existingComment.save).toHaveBeenCalledTimes(1);
    expect(existingComment.setTaggedUsers).toHaveBeenCalledWith(['user-2']);
    expect(response.body.data).toMatchObject({
      id: 303,
      userId: 'user-1',
      comment: 'After',
    });
  });

  it('rejects unauthenticated user when updating comment', async () => {
    const response = await request(app)
      .put('/comments/update-comment/303')
      .send({ comment: 'After' });

    expect(response.status).toBe(401);
    expect(PhotoComment.findByPk).not.toHaveBeenCalled();
  });

  it('rejects user who is not owner when updating comment', async () => {
    const existingComment = {
      id: 303,
      userId: 'user-1',
      comment: 'Before',
      save: jest.fn().mockResolvedValue(undefined),
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
    };

    PhotoComment.findByPk.mockResolvedValue(existingComment);

    const response = await request(app)
      .put('/comments/update-comment/303')
      .set({
        ...authHeaders,
        'x-test-user-id': 'user-2',
      })
      .send({ comment: 'After' });

    expect(response.status).toBe(403);
    expect(existingComment.save).not.toHaveBeenCalled();
  });

  it('rejects empty updated text', async () => {
    const existingComment = {
      id: 303,
      userId: 'user-1',
      comment: 'Before',
      save: jest.fn().mockResolvedValue(undefined),
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
    };

    PhotoComment.findByPk.mockResolvedValue(existingComment);

    const response = await request(app)
      .put('/comments/update-comment/303')
      .set(authHeaders)
      .send({ comment: '   ' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: 'comment is required' });
    expect(existingComment.save).not.toHaveBeenCalled();
  });

  it('returns 404 for missing comment when updating', async () => {
    PhotoComment.findByPk.mockResolvedValue(null);

    const response = await request(app)
      .put('/comments/update-comment/999')
      .set(authHeaders)
      .send({ comment: 'After' });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: 'Resource not found' });
  });

  it('updates only allowed fields', async () => {
    const existingComment = {
      id: 303,
      userId: 'user-1',
      uploadId: 'upload-1',
      comment: 'Before',
      imageUrl: 'comment/photo.jpg',
      save: jest.fn().mockResolvedValue(undefined),
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
    };
    const updatedComment = {
      id: 303,
      userId: 'user-1',
      uploadId: 'upload-1',
      comment: 'After',
      imageUrl: 'comment/photo.jpg',
      taggedUsers: [],
    };

    PhotoComment.findByPk
      .mockResolvedValueOnce(existingComment)
      .mockResolvedValueOnce(updatedComment);

    const response = await request(app)
      .put('/comments/update-comment/303')
      .set(authHeaders)
      .send({
        comment: 'After',
        userId: 'user-2',
        uploadId: 'upload-2',
        imageUrl: 'comment/other.jpg',
      });

    expect(response.status).toBe(200);
    expect(existingComment.comment).toBe('After');
    expect(existingComment.userId).toBe('user-1');
    expect(existingComment.uploadId).toBe('upload-1');
    expect(existingComment.imageUrl).toBe('comment/photo.jpg');
  });

  it('does not change authorId when updating comment', async () => {
    const existingComment = {
      id: 303,
      userId: 'user-1',
      comment: 'Before',
      save: jest.fn().mockResolvedValue(undefined),
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
    };
    const updatedComment = {
      id: 303,
      userId: 'user-1',
      comment: 'After',
      taggedUsers: [],
    };

    PhotoComment.findByPk
      .mockResolvedValueOnce(existingComment)
      .mockResolvedValueOnce(updatedComment);

    const response = await request(app)
      .put('/comments/update-comment/303')
      .set(authHeaders)
      .send({
        comment: 'After',
        userId: 'user-2',
      });

    expect(response.status).toBe(200);
    expect(existingComment.userId).toBe('user-1');
    expect(response.body.data.userId).toBe('user-1');
  });

  it('deletes a comment, its tags, and its image upload', async () => {
    const existingComment = {
      id: 404,
      userId: 'user-1',
      imageUrl: 'comment/photo.jpg',
      setTaggedUsers: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const upload = {
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    PhotoComment.findByPk.mockResolvedValue(existingComment);
    Upload.findOne.mockResolvedValue(upload);

    const response = await request(app)
      .delete('/comments/delete-comment/404')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(s3.deleteObject).toHaveBeenCalledWith({
      Bucket: 'duga-user-photo',
      Key: 'test/comment/photo.jpg',
    });
    expect(Upload.findOne).toHaveBeenCalledWith({
      where: { url: 'test/comment/photo.jpg' },
    });
    expect(upload.destroy).toHaveBeenCalledTimes(1);
    expect(existingComment.setTaggedUsers).toHaveBeenCalledWith([]);
    expect(existingComment.destroy).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      commentId: '404',
      message: 'Comment, image, and upload deleted successfully',
    });
  });
});
