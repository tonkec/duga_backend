process.env.AUTH0_DOMAIN = 'auth.example.com';
process.env.AUTH0_CLIENT_ID = 'client-id';
process.env.AUTH0_CLIENT_SECRET = 'client-secret';
process.env.AUTH0_AUDIENCE = 'duga-api';
process.env.VERIFICATION_EMAIL_THROTTLE_MS = '60000';

jest.mock('axios', () => ({
  post: jest.fn(),
}));

jest.mock('jwks-rsa', () => ({
  expressJwtSecret: jest.fn(() => 'auth0-public-key'),
}));

jest.mock('express-jwt', () => ({
  expressjwt: jest.fn(() => (req, res, next) => {
    if (req.headers.authorization === 'Bearer valid-auth0-token') {
      req.auth = { sub: 'auth0|token-user' };
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
  }),
}));

jest.mock('../utils/s3', () => ({
  listObjectsV2: jest.fn(),
  deleteObjects: jest.fn(),
}));

jest.mock('../models', () => ({
  sequelize: {
    transaction: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    destroy: jest.fn(),
  },
  PhotoComment: { destroy: jest.fn() },
  Upload: { destroy: jest.fn(), findAll: jest.fn() },
  PhotoLikes: { destroy: jest.fn() },
  Message: { destroy: jest.fn() },
  Notification: { destroy: jest.fn() },
}));

const express = require('express');
const request = require('supertest');
const axios = require('axios');
const { User } = require('../models');
const authRouter = require('../router/auth');
const handleSendVerificationEmail = require('../router/auth/handlers/handleSendVerificationEmail');

const buildResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildApp = () => {
  const app = express();

  app.use(express.json());
  app.use('/', authRouter);

  return app;
};

describe('send verification email', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('requires authentication at the route', async () => {
    const response = await request(buildApp())
      .post('/send-verification-email')
      .send({ userId: 123 });

    expect(response.status).toBe(401);
    expect(User.findOne).not.toHaveBeenCalled();
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it('sends verification only for the authenticated Auth0 subject', async () => {
    const req = {
      auth: { sub: 'auth0|token-user' },
      body: { userId: 'attacker-controlled-user-id' },
    };
    const res = buildResponse();

    User.findOne.mockResolvedValue({
      id: 1,
      auth0Id: 'auth0|token-user',
    });
    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'management-token' } })
      .mockResolvedValueOnce({ data: { id: 'verification-job' } });

    await handleSendVerificationEmail(req, res);

    expect(User.findOne).toHaveBeenCalledWith({
      where: { auth0Id: 'auth0|token-user' },
    });
    expect(User.findByPk).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenLastCalledWith(
      'https://auth.example.com/api/v2/jobs/verification-email',
      { user_id: 'auth0|token-user' },
      expect.any(Object)
    );
    expect(res.json).toHaveBeenCalledWith({
      message: 'Verification email sent successfully!',
      data: { id: 'verification-job' },
    });
  });

  it('throttles repeat verification requests for the same user', async () => {
    const req = {
      auth: { sub: 'auth0|throttled-user' },
      body: {},
    };
    const res = buildResponse();
    const throttledRes = buildResponse();

    User.findOne.mockResolvedValue({
      id: 2,
      auth0Id: 'auth0|throttled-user',
    });
    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'management-token' } })
      .mockResolvedValueOnce({ data: { id: 'verification-job' } });

    await handleSendVerificationEmail(req, res);
    await handleSendVerificationEmail(req, throttledRes);

    expect(throttledRes.status).toHaveBeenCalledWith(429);
    expect(throttledRes.json).toHaveBeenCalledWith({
      error: 'Verification email recently sent',
    });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});
