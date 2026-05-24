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
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing auth0Id in token' });
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
});
