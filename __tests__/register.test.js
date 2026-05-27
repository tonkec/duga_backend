jest.mock('../models', () => ({
  User: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
}));

const { User } = require('../models');
const handleRegister = require('../router/auth/handlers/handleRegister');

const buildResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const buildUser = (overrides = {}) => ({
  id: 1,
  auth0Id: 'auth0|token-user',
  email: 'token@example.com',
  username: 'token-user',
  activeSessionIdHash: 'secret-session',
  activeSessionStartedAt: new Date('2026-05-27T00:00:00.000Z'),
  toJSON() {
    return {
      id: this.id,
      auth0Id: this.auth0Id,
      email: this.email,
      username: this.username,
      activeSessionIdHash: this.activeSessionIdHash,
      activeSessionStartedAt: this.activeSessionStartedAt,
    };
  },
  update: jest.fn(async function update(values) {
    Object.assign(this, values);
    return this;
  }),
  ...overrides,
});

describe('register handler', () => {
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

  it('requires Auth0 identity claims from the verified token', async () => {
    const req = { body: { username: 'attacker' } };
    const res = buildResponse();

    await handleRegister(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Missing Auth0 identity claims',
    });
    expect(User.findOne).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it('creates users from token auth0Id and email instead of body identity fields', async () => {
    const createdUser = buildUser();
    const req = {
      auth: { sub: 'auth0|token-user', email: 'Token@Example.com' },
      body: {
        auth0Id: 'auth0|attacker',
        email: 'attacker@example.com',
        username: 'token-user',
      },
    };
    const res = buildResponse();

    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    User.create.mockResolvedValue(createdUser);

    await handleRegister(req, res);

    expect(User.create).toHaveBeenCalledWith({
      auth0Id: 'auth0|token-user',
      email: 'token@example.com',
      username: 'token-user',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User created',
      user: {
        id: 1,
        email: 'token@example.com',
        username: 'token-user',
      },
    });
  });

  it('links legacy email records to the token auth0Id only', async () => {
    const legacyUser = buildUser({ auth0Id: null });
    const req = {
      auth: { sub: 'auth0|token-user', email: 'token@example.com' },
      body: { auth0Id: 'auth0|attacker', username: 'token-user' },
    };
    const res = buildResponse();

    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(legacyUser);

    await handleRegister(req, res);

    expect(legacyUser.update).toHaveBeenCalledWith({
      auth0Id: 'auth0|token-user',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].user).toEqual({
      id: 1,
      email: 'token@example.com',
      username: 'token-user',
    });
  });

  it('rejects email records already linked to another Auth0 user', async () => {
    const existingUser = buildUser({ auth0Id: 'auth0|other-user' });
    const req = {
      auth: { sub: 'auth0|token-user', email: 'token@example.com' },
      body: { username: 'token-user' },
    };
    const res = buildResponse();

    User.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingUser);

    await handleRegister(req, res);

    expect(existingUser.update).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Email is already registered',
    });
  });
});
