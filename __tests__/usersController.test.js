jest.mock('../models', () => ({
  AuthRateLimit: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  ProfileView: {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  User: {
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
}));

const { Op } = require('sequelize');
const { AuthRateLimit, ProfileView, User } = require('../models');
const handleGetAllUsers = require('../router/users/handlers/handleGetAllUsers');
const handleGetCurrentUser = require('../router/users/handlers/handleGetCurrentUser');
const handleGetUserById = require('../router/users/handlers/handleGetUserById');
const handleGetUserByUsername = require('../router/users/handlers/handleGetUserByUsername');
const handleGetUserOnlineStatus = require('../router/users/handlers/handleGetUserOnlineStatus');
const handleGetProfileViews = require('../router/users/handlers/handleGetProfileViews');
const handlePostLogin = require('../router/users/handlers/handlePostLogin');
const handleUpdateUser = require('../router/users/handlers/handleUpdateUser');

const buildResponse = () => {
  const res = {};
  res.set = jest.fn(() => res);
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

describe('users controller handlers', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    AuthRateLimit.findOne.mockResolvedValue(null);
    AuthRateLimit.create.mockResolvedValue({});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('gets all users without sensitive fields', async () => {
    const users = [
      {
        id: 1,
        publicId: 'public-1',
        username: 'antonija',
        avatar: 'avatar.jpg',
        status: 'online',
        email: 'antonija@example.com',
        bio: 'decrypted private bio',
        spirituality: 'decrypted private text',
      },
    ];
    const req = {
      auth: { user: { id: 1 }, sub: 'auth0|user-1' },
      headers: { 'x-forwarded-for': '203.0.113.50' },
      query: { page: '2', limit: '10' },
    };
    const res = buildResponse();

    User.findAndCountAll.mockResolvedValue({ rows: users, count: 21 });

    await handleGetAllUsers(req, res);

    expect(User.findAndCountAll).toHaveBeenCalledWith({
      attributes: ['id', 'publicId', 'username', 'avatar', 'status'],
      order: [['id', 'ASC']],
      limit: 10,
      offset: 10,
    });
    expect(AuthRateLimit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_enumeration',
        key: 'user:auth0|user-1',
      })
    );
    expect(AuthRateLimit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_enumeration',
        key: 'ip:203.0.113.50',
      })
    );
    expect(res.json).toHaveBeenCalledWith({
      data: [
        {
          id: 1,
          publicId: 'public-1',
          username: 'antonija',
          avatar: 'avatar.jpg',
          status: 'online',
        },
      ],
      pagination: {
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      },
    });
  });

  it('requires pagination when listing users', async () => {
    const req = { query: {}, headers: {}, auth: { user: { id: 1 } } };
    const res = buildResponse();

    await handleGetAllUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      errors: ['page and limit query parameters are required'],
    });
    expect(User.findAndCountAll).not.toHaveBeenCalled();
  });

  it('caps user listing page size', async () => {
    const req = {
      auth: { user: { id: 1 }, sub: 'auth0|user-1' },
      headers: {},
      query: { page: '1', limit: '500' },
    };
    const res = buildResponse();

    User.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    await handleGetAllUsers(req, res);

    expect(User.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 50,
        offset: 0,
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ limit: 50 }),
      })
    );
  });

  it('rate limits user enumeration', async () => {
    const req = {
      auth: { user: { id: 1 }, sub: 'auth0|user-1' },
      headers: {},
      query: { page: '1', limit: '10' },
    };
    const res = buildResponse();

    AuthRateLimit.findOne.mockResolvedValue({
      expiresAt: new Date(Date.now() + 10_000),
    });

    await handleGetAllUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.set).toHaveBeenCalledWith('Retry-After', '10');
    expect(res.json).toHaveBeenCalledWith({ errors: ['rate_limited'] });
    expect(User.findAndCountAll).not.toHaveBeenCalled();
  });

  it('gets current user by authenticated user id', async () => {
    const user = { id: 1, username: 'antonija' };
    const req = { auth: { user: { id: 1 } } };
    const res = buildResponse();

    User.findByPk.mockResolvedValue(user);

    await handleGetCurrentUser(req, res);

    expect(User.findByPk).toHaveBeenCalledWith(
      1,
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
    expect(res.json).toHaveBeenCalledWith(user);
  });

  it('returns 404 when current user is missing', async () => {
    const req = { auth: { user: { id: 1 } } };
    const res = buildResponse();

    User.findByPk.mockResolvedValue(null);

    await handleGetCurrentUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('gets user by id without sensitive fields', async () => {
    const user = {
      id: 2,
      publicId: 'public-2',
      username: 'duga',
      avatar: 'avatar.jpg',
      status: 'offline',
      email: 'duga@example.com',
      bio: 'decrypted private bio',
      favoriteSong: 'decrypted private song',
    };
    const req = { auth: { user: { id: 1 } }, params: { id: '2' } };
    const res = buildResponse();

    User.findByPk.mockResolvedValue(user);

    await handleGetUserById(req, res);

    expect(User.findByPk).toHaveBeenCalledWith(
      '2',
      expect.objectContaining({
        attributes: ['id', 'publicId', 'username', 'avatar', 'status'],
      })
    );
    expect(res.json).toHaveBeenCalledWith({
      id: 2,
      publicId: 'public-2',
      username: 'duga',
      avatar: 'avatar.jpg',
      status: 'offline',
    });
    expect(ProfileView.create).toHaveBeenCalledWith({
      viewerId: 1,
      viewedUserId: 2,
    });
  });

  it('lists profile viewers with timestamps', async () => {
    const req = { auth: { user: { id: 1 } }, query: { page: '2', limit: '5' } };
    const res = buildResponse();
    const rows = [
      {
        id: 1,
        viewerId: 2,
        viewedUserId: 1,
        createdAt: new Date('2026-05-25T19:05:00.000Z'),
        viewer: { id: 2, username: 'duga' },
      },
    ];

    ProfileView.findAndCountAll.mockResolvedValue({ count: 6, rows });

    await handleGetProfileViews(req, res);

    expect(ProfileView.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { viewedUserId: 1 },
        order: [['createdAt', 'DESC']],
        limit: 5,
        offset: 5,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: rows,
      pagination: {
        page: 2,
        limit: 5,
        total: 6,
        totalPages: 2,
      },
    });
  });

  it('searches users by username prefix', async () => {
    const users = [{ id: 2, username: 'duga' }];
    const req = { params: { username: 'dug' } };
    const res = buildResponse();

    User.findAll.mockResolvedValue(users);

    await handleGetUserByUsername(req, res);

    expect(User.findAll).toHaveBeenCalledWith({
      where: {
        username: {
          [Op.iLike]: 'dug%',
          [Op.escape]: '\\',
        },
      },
      attributes: ['id', 'publicId', 'username'],
      limit: 10,
    });
    expect(res.json).toHaveBeenCalledWith({ users });
  });

  it('rejects username searches that are too short', async () => {
    const req = { params: { username: 'du' } };
    const res = buildResponse();

    await handleGetUserByUsername(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Username search must be at least 3 characters',
    });
    expect(User.findAll).not.toHaveBeenCalled();
  });

  it('escapes username LIKE wildcards', async () => {
    const req = { params: { username: 'a%_' } };
    const res = buildResponse();

    User.findAll.mockResolvedValue([]);

    await handleGetUserByUsername(req, res);

    expect(User.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          username: {
            [Op.iLike]: 'a\\%\\_%',
            [Op.escape]: '\\',
          },
        },
      })
    );
  });

  it('gets current user online status', async () => {
    const req = { auth: { user: { id: 1 } } };
    const res = buildResponse();

    User.findByPk.mockResolvedValue({ status: 'online' });

    await handleGetUserOnlineStatus(req, res);

    expect(User.findByPk).toHaveBeenCalledWith(1, {
      attributes: ['status'],
    });
    expect(res.json).toHaveBeenCalledWith({ status: 'online' });
  });

  it('updates only allowed profile fields', async () => {
    const req = {
      auth: { user: { id: 1 } },
      body: {
        data: {
          firstName: 'Ana',
          bio: 'Updated',
          email: 'attacker@example.com',
          auth0Id: 'auth0|attacker',
          password: 'secret',
        },
      },
    };
    const res = buildResponse();
    const updatedUser = {
      avatar: 'avatar.jpg',
      get: jest.fn(() => ({
        id: 1,
        firstName: 'Ana',
        bio: 'Updated',
        email: 'user@example.com',
        auth0Id: 'auth0|user-1',
        password: 'hashed',
        activeSessionIdHash: 'hash',
      })),
    };

    User.update.mockResolvedValue([1, [updatedUser]]);

    await handleUpdateUser(req, res);

    expect(User.update).toHaveBeenCalledWith(
      {
        firstName: 'Ana',
        bio: 'Updated',
      },
      expect.objectContaining({
        where: { id: 1 },
        returning: true,
        individualHooks: true,
      })
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.not.objectContaining({
        auth0Id: expect.anything(),
        password: expect.anything(),
        activeSessionIdHash: expect.anything(),
      })
    );
  });

  it('normalizes empty optional profile enums when updating', async () => {
    const req = {
      auth: { user: { id: 1 } },
      body: {
        data: {
          lookingFor: '',
          relationshipStatus: '',
          favoriteDay: '',
          favoriteSong: 'https://www.youtube.com/embed/2ElwsEdX1UA',
          favoriteMovie: 'https://www.imdb.com/title/tt0111161/',
          cigarettes: false,
        },
      },
    };
    const res = buildResponse();
    const updatedUser = {
      avatar: 'avatar.jpg',
      get: jest.fn(() => ({
        id: 1,
        lookingFor: null,
        relationshipStatus: null,
        favoriteDayOfWeek: null,
        favoriteSong: 'https://www.youtube.com/embed/2ElwsEdX1UA',
        favoriteMovie: 'https://www.imdb.com/title/tt0111161/',
      })),
    };

    User.update.mockResolvedValue([1, [updatedUser]]);

    await handleUpdateUser(req, res);

    expect(User.update).toHaveBeenCalledWith(
      {
        lookingFor: null,
        relationshipStatus: null,
        favoriteDayOfWeek: null,
        favoriteSong: 'https://www.youtube.com/embed/2ElwsEdX1UA',
        favoriteMovie: 'https://www.imdb.com/title/tt0111161/',
        cigarettes: false,
      },
      expect.objectContaining({
        where: { id: 1 },
      })
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        favoriteSong: 'https://www.youtube.com/embed/2ElwsEdX1UA',
        favoriteMovie: 'https://www.imdb.com/title/tt0111161/',
      })
    );
  });

  it('validates profile update payload', async () => {
    const req = { auth: { user: { id: 1 } }, body: {} };
    const res = buildResponse();

    await handleUpdateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Profile data is required',
    });
    expect(User.update).not.toHaveBeenCalled();
  });

  it('rejects invalid and oversized profile update values', async () => {
    const req = {
      auth: { user: { id: 1 } },
      body: {
        data: {
          firstName: 'A'.repeat(81),
          lookingFor: 'admin',
          cigarettes: 'yes',
        },
      },
    };
    const res = buildResponse();

    await handleUpdateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      errors: [
        'firstName must be 80 characters or less',
        'lookingFor is invalid',
        'cigarettes must be a boolean or null',
      ],
    });
    expect(User.update).not.toHaveBeenCalled();
  });

  it('post-login validates missing auth', async () => {
    const req = { body: { data: {} } };
    const res = buildResponse();

    await handlePostLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      errors: ['unauthorized'],
    });
  });

  it('post-login saves onboarding data for a valid user', async () => {
    const user = {
      id: 1,
      auth0Id: 'auth0|user-1',
      username: null,
      age: null,
      accept_privacy: null,
      accept_terms: null,
      onboarding_done: false,
      first_login_at: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const req = {
      auth: { sub: 'auth0|user-1' },
      body: {
        data: {
          username: 'antonija',
          age: 28,
          acceptPrivacy: true,
          acceptTerms: true,
        },
      },
    };
    const res = buildResponse();

    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(user);

    await handlePostLogin(req, res);

    expect(user.username).toBe('antonija');
    expect(user.age).toBe(28);
    expect(user.accept_privacy).toBe(true);
    expect(user.accept_terms).toBe(true);
    expect(user.onboarding_done).toBe(true);
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        user: expect.objectContaining({
          id: 1,
          username: 'antonija',
        }),
      })
    );
  });

  it('post-login allows the current user to keep their existing username', async () => {
    const user = {
      id: 1,
      auth0Id: 'auth0|user-1',
      username: 'antonija',
      age: null,
      accept_privacy: null,
      accept_terms: null,
      onboarding_done: false,
      first_login_at: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const req = {
      auth: { sub: 'auth0|user-1' },
      body: {
        data: {
          username: 'antonija',
          age: 28,
          acceptPrivacy: true,
          acceptTerms: true,
        },
      },
    };
    const res = buildResponse();

    User.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(user);

    await handlePostLogin(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        user: expect.objectContaining({
          id: 1,
          username: 'antonija',
        }),
      })
    );
  });

  it('post-login handles username lookup errors with the normal server error response', async () => {
    const req = {
      auth: { sub: 'auth0|user-1' },
      body: {
        data: {
          username: 'antonija',
          age: 28,
          acceptPrivacy: true,
          acceptTerms: true,
        },
      },
    };
    const res = buildResponse();

    User.findOne.mockRejectedValueOnce(new Error('database unavailable'));

    await handlePostLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      errors: ['server_error'],
    });
  });
});
