process.env.AUTH0_DOMAIN = 'auth.example.com';
process.env.AUTH0_CLIENT_ID = 'client-id';
process.env.AUTH0_CLIENT_SECRET = 'client-secret';

jest.mock('axios', () => ({
  post: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('../utils/s3', () => ({
  listObjectsV2: jest.fn(),
  deleteObjects: jest.fn(),
}));

jest.mock('../models', () => ({
  sequelize: {
    transaction: jest.fn(),
    query: jest.fn(),
  },
  User: {
    destroy: jest.fn(),
  },
  PhotoComment: {
    destroy: jest.fn(),
  },
  Upload: {
    destroy: jest.fn(),
    findAll: jest.fn(),
  },
  PhotoLikes: {
    destroy: jest.fn(),
  },
  Message: {
    destroy: jest.fn(),
  },
  Notification: {
    destroy: jest.fn(),
  },
}));

const axios = require('axios');
const s3 = require('../utils/s3');
const {
  Message,
  Notification,
  PhotoComment,
  PhotoLikes,
  Upload,
  User,
  sequelize,
} = require('../models');
const handleDeleteUser = require('../router/auth/handlers/handleDeleteUser');

const buildResponse = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe('delete user', () => {
  let transaction;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    transaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    sequelize.transaction.mockResolvedValue(transaction);
    sequelize.query.mockResolvedValue(undefined);

    Notification.destroy.mockResolvedValue(1);
    PhotoComment.destroy.mockResolvedValue(1);
    PhotoLikes.destroy.mockResolvedValue(1);
    Upload.destroy.mockResolvedValue(1);
    Message.destroy.mockResolvedValue(1);
    User.destroy.mockResolvedValue(1);

    s3.listObjectsV2.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Contents: [{ Key: 'user/42/profile.jpg' }],
      }),
    });
    s3.deleteObjects.mockReturnValue({
      promise: jest.fn().mockResolvedValue(undefined),
    });

    axios.post.mockResolvedValue({
      data: { access_token: 'management-token' },
    });
    axios.delete.mockResolvedValue({});

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('deletes all upload-backed S3 files before deleting upload records', async () => {
    Upload.findAll.mockResolvedValue([
      { url: 'development/forum/question/42/question.jpg' },
      { url: 'development/forum/answer/42/answer.jpg' },
      {
        url: 'http://localhost:8080/uploads/files/development%2Fforum%2Fanswer%2F42%2Fencoded.jpg',
      },
    ]);

    const req = {
      auth: {
        user: {
          id: 42,
          auth0Id: 'auth0|user-42',
        },
      },
    };
    const res = buildResponse();

    await handleDeleteUser(req, res);

    expect(Upload.findAll).toHaveBeenCalledWith({
      where: { userId: 42 },
      attributes: ['url'],
      transaction,
    });
    expect(s3.deleteObjects).toHaveBeenCalledWith({
      Bucket: 'duga-user-photo',
      Delete: {
        Objects: expect.arrayContaining([
          { Key: 'user/42/profile.jpg' },
          { Key: 'development/forum/question/42/question.jpg' },
          { Key: 'development/forum/answer/42/answer.jpg' },
          { Key: 'development/forum/answer/42/encoded.jpg' },
        ]),
      },
    });
    expect(Upload.destroy).toHaveBeenCalledWith({
      where: { userId: 42 },
      transaction,
    });
    expect(User.destroy).toHaveBeenCalledWith({
      where: { id: 42 },
      transaction,
    });
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.rollback).not.toHaveBeenCalled();
    expect(axios.delete).toHaveBeenCalledWith(
      'https://auth.example.com/api/v2/users/auth0%7Cuser-42',
      expect.objectContaining({
        headers: { Authorization: 'Bearer management-token' },
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
