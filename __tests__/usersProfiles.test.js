process.env.API_JWT_SECRET = 'test-api-secret';

const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  ProfileView: {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
  },
}));

const { ProfileView, User } = require('../models');
const usersRouter = require('../router/user');
const { signApiToken } = require('../middleware/apiJwt');
const { SESSION_HEADER, hashSessionId } = require('../utils/appSession');

const buildApp = () => {
  const app = express();
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));

  app.use(express.json());
  app.set('io', { emit, to });
  app.use('/users', usersRouter);

  return app;
};

const buildUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'user-1@example.com',
  auth0Id: 'auth0|user-1',
  firstName: 'Antonija',
  lastName: 'Duga',
  username: 'antonija',
  password: 'hashed-password',
  activeSessionIdHash: hashSessionId('session-1'),
  activeSessionStartedAt: new Date('2026-05-23T00:00:00.000Z'),
  ...overrides,
});

const buildUpdatedUser = (rawUser) => ({
  avatar: rawUser.avatar || 'avatar.jpg',
  get: jest.fn(() => rawUser),
});

describe('users and profiles routes', () => {
  let app;
  let currentUser;
  let apiToken;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();

    currentUser = buildUser();
    apiToken = signApiToken(currentUser);
    User.findOne.mockResolvedValue(currentUser);
  });

  const authenticated = (agent) =>
    agent
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, 'session-1');

  it('gets current user', async () => {
    User.findByPk.mockResolvedValue({
      id: 'user-1',
      email: 'user-1@example.com',
      firstName: 'Antonija',
      username: 'antonija',
    });

    const response = await authenticated(
      request(app).get('/users/current-user')
    );

    expect(response.status).toBe(200);
    expect(User.findByPk).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        attributes: {
          exclude: [
            'password',
            'auth0Id',
            'activeSessionIdHash',
            'activeSessionStartedAt',
          ],
        },
      })
    );
    expect(response.body).toMatchObject({
      id: 'user-1',
      email: 'user-1@example.com',
      firstName: 'Antonija',
    });
  });

  it('gets user by id', async () => {
    User.findByPk.mockResolvedValue({
      id: 'user-2',
      firstName: 'Duga',
      username: 'duga',
    });
    ProfileView.create.mockResolvedValue({
      id: 10,
      viewerId: 'user-1',
      viewedUserId: 'user-2',
      createdAt: '2026-05-25T19:10:00.000Z',
    });

    const response = await authenticated(request(app).get('/users/user-2'));

    expect(response.status).toBe(200);
    expect(User.findByPk).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({
        attributes: {
          exclude: [
            'password',
            'auth0Id',
            'activeSessionIdHash',
            'activeSessionStartedAt',
          ],
        },
      })
    );
    expect(response.body).toMatchObject({
      id: 'user-2',
      username: 'duga',
    });
    expect(ProfileView.create).toHaveBeenCalledWith({
      viewerId: 'user-1',
      viewedUserId: 'user-2',
    });
    expect(app.get('io').to).toHaveBeenCalledWith('user:user-2');
    expect(app.get('io').to().emit).toHaveBeenCalledWith(
      'profile-view-created',
      {
        data: {
          id: 10,
          viewerId: 'user-1',
          viewedUserId: 'user-2',
          createdAt: '2026-05-25T19:10:00.000Z',
          viewer: expect.objectContaining({
            id: 'user-1',
            username: 'antonija',
          }),
        },
      }
    );
  });

  it('gets user by public id', async () => {
    const publicId = '11111111-1111-4111-8111-111111111111';
    User.findOne.mockImplementation(({ where }) => {
      if (where?.auth0Id === currentUser.auth0Id) {
        return Promise.resolve(currentUser);
      }
      if (where?.publicId === publicId) {
        return Promise.resolve({
          id: 'user-2',
          publicId,
          firstName: 'Duga',
          username: 'duga',
        });
      }
      return Promise.resolve(null);
    });
    ProfileView.create.mockResolvedValue({
      id: 11,
      viewerId: 'user-1',
      viewedUserId: 'user-2',
      createdAt: '2026-05-25T19:11:00.000Z',
    });

    const response = await authenticated(
      request(app).get(`/users/${publicId}`)
    );

    expect(response.status).toBe(200);
    expect(User.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publicId },
      })
    );
    expect(response.body).toMatchObject({
      id: 'user-2',
      publicId,
      username: 'duga',
    });
    expect(ProfileView.create).toHaveBeenCalledWith({
      viewerId: 'user-1',
      viewedUserId: 'user-2',
    });
  });

  it('does not record a profile view when viewing yourself', async () => {
    User.findByPk.mockResolvedValue({
      id: 'user-1',
      firstName: 'Antonija',
      username: 'antonija',
    });

    const response = await authenticated(request(app).get('/users/user-1'));

    expect(response.status).toBe(200);
    expect(ProfileView.create).not.toHaveBeenCalled();
    expect(app.get('io').to).not.toHaveBeenCalled();
  });

  it('lists profile viewers for the current user', async () => {
    const viewedAt = '2026-05-25T19:05:00.000Z';
    ProfileView.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [
        {
          id: 10,
          viewerId: 'user-2',
          viewedUserId: 'user-1',
          createdAt: viewedAt,
          viewer: {
            id: 'user-2',
            username: 'duga',
            firstName: 'Duga',
          },
        },
      ],
    });

    const response = await authenticated(
      request(app).get('/users/profile-views?page=1&limit=10')
    );

    expect(response.status).toBe(200);
    expect(ProfileView.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { viewedUserId: 'user-1' },
        order: [['createdAt', 'DESC']],
        limit: 10,
        offset: 0,
      })
    );
    expect(response.body).toEqual({
      data: [
        {
          id: 10,
          viewerId: 'user-2',
          viewedUserId: 'user-1',
          createdAt: viewedAt,
          viewer: {
            id: 'user-2',
            username: 'duga',
            firstName: 'Duga',
          },
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('updates profile', async () => {
    const updatedUser = buildUpdatedUser({
      id: 'user-1',
      email: 'user-1@example.com',
      firstName: 'Ana',
      lastName: 'Duga',
      bio: 'Updated bio',
      avatar: 'avatar.jpg',
    });

    User.update.mockResolvedValue([1, [updatedUser]]);

    const response = await authenticated(
      request(app).post('/users/update-user')
    ).send({
      data: {
        firstName: 'Ana',
        lastName: 'Duga',
        bio: 'Updated bio',
      },
    });

    expect(response.status).toBe(200);
    expect(User.update).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Ana',
        lastName: 'Duga',
        bio: 'Updated bio',
      }),
      expect.objectContaining({
        where: { id: 'user-1' },
        returning: true,
        individualHooks: true,
      })
    );
    expect(response.body).toMatchObject({
      id: 'user-1',
      firstName: 'Ana',
      bio: 'Updated bio',
    });
  });

  it('validates required fields when updating profile', async () => {
    const response = await authenticated(
      request(app).post('/users/update-user')
    ).send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Profile data is required' });
    expect(User.update).not.toHaveBeenCalled();
  });

  it('prevents updating forbidden fields', async () => {
    const updatedUser = buildUpdatedUser({
      id: 'user-1',
      email: 'user-1@example.com',
      firstName: 'Ana',
      auth0Id: 'auth0|user-1',
      activeSessionIdHash: hashSessionId('session-1'),
      password: 'hashed-password',
    });

    User.update.mockResolvedValue([1, [updatedUser]]);

    const response = await authenticated(
      request(app).post('/users/update-user')
    ).send({
      data: {
        firstName: 'Ana',
        id: 'user-2',
        email: 'attacker@example.com',
        auth0Id: 'auth0|attacker',
        password: 'new-password',
        activeSessionIdHash: 'attacker-session',
        role: 'admin',
      },
    });

    const updatePayload = User.update.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(updatePayload).toEqual({ firstName: 'Ana' });
    expect(updatePayload).not.toHaveProperty('id');
    expect(updatePayload).not.toHaveProperty('email');
    expect(updatePayload).not.toHaveProperty('auth0Id');
    expect(updatePayload).not.toHaveProperty('password');
    expect(updatePayload).not.toHaveProperty('activeSessionIdHash');
    expect(updatePayload).not.toHaveProperty('role');
  });

  it('returns 404 for missing user', async () => {
    User.findByPk.mockResolvedValue(null);

    const getResponse = await authenticated(
      request(app).get('/users/missing-user')
    );

    User.update.mockResolvedValue([0, []]);
    const updateResponse = await authenticated(
      request(app).post('/users/update-user')
    ).send({
      data: { firstName: 'Ana' },
    });

    expect(getResponse.status).toBe(404);
    expect(getResponse.body).toEqual({ error: 'User not found' });
    expect(updateResponse.status).toBe(404);
    expect(updateResponse.body).toEqual({ error: 'User not found' });
  });

  it('hides private/sensitive fields', async () => {
    const updatedUser = buildUpdatedUser({
      id: 'user-1',
      email: 'user-1@example.com',
      firstName: 'Ana',
      password: 'hashed-password',
      auth0Id: 'auth0|user-1',
      activeSessionIdHash: hashSessionId('session-1'),
      activeSessionStartedAt: new Date('2026-05-23T00:00:00.000Z'),
    });

    User.update.mockResolvedValue([1, [updatedUser]]);

    const response = await authenticated(
      request(app).post('/users/update-user')
    ).send({
      data: { firstName: 'Ana' },
    });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('auth0Id');
    expect(response.body).not.toHaveProperty('activeSessionIdHash');
    expect(response.body).not.toHaveProperty('activeSessionStartedAt');
  });
});
