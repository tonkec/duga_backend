jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
  },
}));

jest.mock('../utils/canAccess', () => jest.fn());

const { User } = require('../models');
const canAccess = require('../utils/canAccess');
const withAccessCheck = require('../middleware/accessCheck');

const buildResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return res;
};

describe('withAccessCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects requests without auth0Id before querying users', async () => {
    const middleware = withAccessCheck({ findByPk: jest.fn() });
    const req = { auth: {}, params: { id: '1' } };
    const res = buildResponse();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Missing auth0Id in token',
    });
    expect(User.findOne).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the attached current user when available', async () => {
    const resource = { id: 'photo-1', userId: 'user-1' };
    const model = { findByPk: jest.fn().mockResolvedValue(resource) };
    const currentUser = { id: 'user-1', auth0Id: 'auth0|user-1' };
    const middleware = withAccessCheck(model);
    const req = {
      auth: { sub: 'auth0|user-1' },
      currentUser,
      params: { id: 'photo-1' },
    };
    const res = buildResponse();
    const next = jest.fn();

    canAccess.mockResolvedValue(true);

    await middleware(req, res, next);

    expect(User.findOne).not.toHaveBeenCalled();
    expect(canAccess).toHaveBeenCalledWith(currentUser, resource);
    expect(req.resource).toBe(resource);
    expect(req.user).toBe(currentUser);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects when authenticated user cannot be found', async () => {
    const middleware = withAccessCheck({ findByPk: jest.fn() });
    const req = {
      auth: { sub: 'auth0|missing' },
      params: { id: 'resource-1' },
    };
    const res = buildResponse();
    const next = jest.fn();

    User.findOne.mockResolvedValue(null);

    await middleware(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({
      where: { auth0Id: 'auth0|missing' },
    });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects default model lookup without a resource id', async () => {
    const model = { findByPk: jest.fn() };
    const middleware = withAccessCheck(model);
    const req = {
      auth: { sub: 'auth0|user-1' },
      currentUser: { id: 'user-1', auth0Id: 'auth0|user-1' },
      params: {},
    };
    const res = buildResponse();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing resource ID' });
    expect(model.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when the looked-up resource does not exist', async () => {
    const model = { findByPk: jest.fn().mockResolvedValue(null) };
    const middleware = withAccessCheck(model);
    const req = {
      auth: { sub: 'auth0|user-1' },
      currentUser: { id: 'user-1', auth0Id: 'auth0|user-1' },
      params: { id: 'missing' },
    };
    const res = buildResponse();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(model.findByPk).toHaveBeenCalledWith('missing');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Resource not found' });
    expect(canAccess).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when canAccess denies the resource', async () => {
    const resource = { id: 'resource-1', userId: 'owner-2' };
    const model = { findByPk: jest.fn().mockResolvedValue(resource) };
    const currentUser = { id: 'user-1', auth0Id: 'auth0|user-1' };
    const middleware = withAccessCheck(model);
    const req = {
      auth: { sub: 'auth0|user-1' },
      currentUser,
      params: { id: 'resource-1' },
    };
    const res = buildResponse();
    const next = jest.fn();

    canAccess.mockResolvedValue(false);

    await middleware(req, res, next);

    expect(canAccess).toHaveBeenCalledWith(currentUser, resource);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('uses custom lookup functions for model-specific authorization', async () => {
    const resource = { id: 'membership-1', chatId: 77, userId: 'user-1' };
    const lookupFn = jest.fn().mockResolvedValue(resource);
    const currentUser = { id: 'user-1', auth0Id: 'auth0|user-1' };
    const middleware = withAccessCheck({ findByPk: jest.fn() }, lookupFn);
    const req = {
      auth: { sub: 'auth0|user-1' },
      currentUser,
      params: { id: '77' },
    };
    const res = buildResponse();
    const next = jest.fn();

    canAccess.mockResolvedValue(true);

    await middleware(req, res, next);

    expect(lookupFn).toHaveBeenCalledWith(req);
    expect(req.resource).toBe(resource);
    expect(next).toHaveBeenCalledWith();
  });
});
