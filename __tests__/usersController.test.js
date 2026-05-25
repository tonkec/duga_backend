jest.mock('../models', () => ({
  User: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
}));

const { Op } = require('sequelize');
const { User } = require('../models');
const handleGetAllUsers = require('../router/users/handlers/handleGetAllUsers');
const handleGetCurrentUser = require('../router/users/handlers/handleGetCurrentUser');
const handleGetUserById = require('../router/users/handlers/handleGetUserById');
const handleGetUserByUsername = require('../router/users/handlers/handleGetUserByUsername');
const handleGetUserOnlineStatus = require('../router/users/handlers/handleGetUserOnlineStatus');
const handlePostLogin = require('../router/users/handlers/handlePostLogin');
const handleUpdateUser = require('../router/users/handlers/handleUpdateUser');

const buildResponse = () => {
  const res = {};
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
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('gets all users without sensitive fields', async () => {
    const users = [{ id: 1, username: 'antonija' }];
    const req = {};
    const res = buildResponse();

    User.findAll.mockResolvedValue(users);

    await handleGetAllUsers(req, res);

    expect(User.findAll).toHaveBeenCalledWith({
      attributes: {
        exclude: [
          'password',
          'auth0Id',
          'activeSessionIdHash',
          'activeSessionStartedAt',
        ],
      },
    });
    expect(res.json).toHaveBeenCalledWith(users);
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
    const user = { id: 2, username: 'duga' };
    const req = { params: { id: '2' } };
    const res = buildResponse();

    User.findByPk.mockResolvedValue(user);

    await handleGetUserById(req, res);

    expect(User.findByPk).toHaveBeenCalledWith(
      '2',
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

  it('searches users by username prefix', async () => {
    const users = [{ id: 2, username: 'duga' }];
    const req = { params: { username: 'du' } };
    const res = buildResponse();

    User.findAll.mockResolvedValue(users);

    await handleGetUserByUsername(req, res);

    expect(User.findAll).toHaveBeenCalledWith({
      where: {
        username: {
          [Op.iLike]: 'du%',
        },
      },
      attributes: ['id', 'username'],
      limit: 10,
    });
    expect(res.json).toHaveBeenCalledWith({ users });
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
      auth0_user_id: 'auth0|user-1',
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
});
