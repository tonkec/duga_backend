process.env.API_JWT_SECRET = 'test-api-secret';
process.env.AUTH0_DOMAIN = 'auth.example.com';
process.env.AUTH0_AUDIENCE = 'duga-api';

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('jwks-rsa', () => ({
  expressJwtSecret: jest.fn(() => 'auth0-public-key'),
}));

jest.mock('express-jwt', () => ({
  expressjwt: jest.fn(() => (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (
      authHeader === 'Bearer valid-auth0-token' ||
      authHeader?.startsWith('Bearer eyJ')
    ) {
      req.auth = {
        sub: 'auth0|user-1',
        email: 'user-1@example.com',
        email_verified: true,
      };
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
  }),
}));

jest.mock('../models', () => ({
  AppSession: {
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
  AuthRateLimit: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
  },
}));

const { AppSession, AuthRateLimit, User } = require('../models');
const sessionsRouter = require('../router/sessions');
const {
  authenticatedAppSession,
} = require('../middleware/authenticatedAppSession');
const {
  SESSION_HEADER,
  SESSION_COOKIE,
  CSRF_COOKIE,
  hashSessionId,
  SESSION_CONFLICT_CODE,
  SESSION_REVOKED_CODE,
} = require('../utils/appSession');
const { signApiToken } = require('../middleware/apiJwt');

const VALID_SESSION_ID = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFG';
const OTHER_SESSION_ID = '7654321098abcdefghijklmnopqrstuvwxyzABCDEFG';
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

const buildApp = () => {
  const app = express();

  app.use(express.json());
  app.use('/sessions', sessionsRouter);
  app.get('/protected', authenticatedAppSession, (req, res) => {
    res.json({ ok: true, userId: req.auth.user.id });
  });

  return app;
};

const buildUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'user-1@example.com',
  auth0Id: 'auth0|user-1',
  activeSessionIdHash: hashSessionId(VALID_SESSION_ID),
  activeSessionStartedAt: new Date('2026-05-23T00:00:00.000Z'),
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const buildRs256LikeToken = () => {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' })
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'auth0|user-1',
      user: {
        id: 'user-1',
        email: 'user-1@example.com',
        auth0Id: 'auth0|user-1',
      },
      tokenUse: 'api',
      exp: Math.floor(Date.now() / 1000) + 60,
    })
  ).toString('base64url');

  return `${header}.${payload}.signature`;
};

describe('auth and session routes', () => {
  let app;
  let consoleErrorSpy;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    AuthRateLimit.findOne.mockResolvedValue(null);
    AuthRateLimit.create.mockResolvedValue({});
    AppSession.create.mockResolvedValue({});
    AppSession.findOne.mockResolvedValue(null);
    AppSession.update.mockResolvedValue([0]);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    delete process.env.DUGA_COOKIE_SAMESITE;
    delete process.env.DUGA_COOKIE_SECURE;
  });

  it('starts session with valid Auth0 token', async () => {
    const user = buildUser({ activeSessionIdHash: null });
    const revokeUserSessionsExcept = jest.fn();

    app.set('revokeUserSessionsExcept', revokeUserSessionsExcept);
    User.findOne.mockResolvedValue(user);
    User.findByPk.mockResolvedValue(user);

    const response = await request(app)
      .post('/sessions/start')
      .set('Authorization', 'Bearer valid-auth0-token')
      .set('User-Agent', 'jest');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      session: { authenticated: true, expiresAt: expect.any(String) },
    });
    expect(response.body.token).toBeUndefined();
    expect(response.headers['set-cookie'].join(';')).toContain('duga_session=');
    expect(response.headers['set-cookie'].join(';')).toContain('duga_csrf=');
    expect(AppSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        auth0Id: 'auth0|user-1',
        sessionIdHash: expect.any(String),
        csrfTokenHash: expect.any(String),
        userAgent: 'jest',
        expiresAt: expect.any(Date),
        rotationVersion: 0,
      })
    );
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSessionIdHash: expect.any(String),
        isVerified: true,
      })
    );
    expect(revokeUserSessionsExcept).toHaveBeenCalledWith(
      'user-1',
      expect.any(String)
    );
  });

  it('sets cross-site secure cookies in staging', async () => {
    process.env.NODE_ENV = 'staging';
    const user = buildUser({ activeSessionIdHash: null });

    User.findOne.mockResolvedValue(user);
    User.findByPk.mockResolvedValue(user);

    const response = await request(app)
      .post('/sessions/start')
      .set('Authorization', 'Bearer valid-auth0-token');

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          new RegExp(
            `^${SESSION_COOKIE}=.+; Max-Age=\\d+; Path=/; Expires=.+; HttpOnly; Secure; SameSite=None$`
          )
        ),
        expect.stringMatching(
          new RegExp(
            `^${CSRF_COOKIE}=.+; Max-Age=\\d+; Path=/; Expires=.+; Secure; SameSite=None$`
          )
        ),
      ])
    );
  });

  it('generates the app session server-side', async () => {
    const user = buildUser({ activeSessionIdHash: null });

    User.findOne.mockResolvedValue(user);
    User.findByPk.mockResolvedValue(user);

    const response = await request(app)
      .post('/sessions/start')
      .set('Authorization', 'Bearer valid-auth0-token');

    expect(response.status).toBe(200);
    expect(AppSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionIdHash: expect.any(String),
      })
    );
    expect(user.update).toHaveBeenCalled();
  });

  it('does not start a session when the Auth0 user is unknown locally', async () => {
    User.findOne.mockResolvedValue(null);

    const response = await request(app)
      .post('/sessions/start')
      .set('Authorization', 'Bearer valid-auth0-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized: user not found' });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it('rate limits repeated session starts by user and ip', async () => {
    const user = buildUser({ activeSessionIdHash: null });
    const activeLimit = {
      expiresAt: new Date(Date.now() + 10_000),
    };

    AuthRateLimit.findOne.mockResolvedValue(activeLimit);
    User.findOne.mockResolvedValue(user);
    User.findByPk.mockResolvedValue(user);

    const response = await request(app)
      .post('/sessions/start')
      .set('Authorization', 'Bearer valid-auth0-token');

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('10');
    expect(response.body).toEqual({
      ok: false,
      errors: ['rate_limited'],
    });
    expect(User.findByPk).not.toHaveBeenCalled();
    expect(user.update).not.toHaveBeenCalled();
  });

  it('rejects invalid/expired token when starting a session', async () => {
    const response = await request(app)
      .post('/sessions/start')
      .set('Authorization', 'Bearer expired-auth0-token');

    expect(response.status).toBe(401);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('prefers HS256 API JWT for protected routes', async () => {
    const user = buildUser();
    const apiToken = signApiToken(user);

    User.findOne.mockResolvedValue(user);

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, VALID_SESSION_ID);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, userId: 'user-1' });
  });

  it('accepts the HttpOnly app session cookie for protected routes', async () => {
    const user = buildUser();
    const appSession = {
      userId: user.id,
      auth0Id: user.auth0Id,
      update: jest.fn().mockResolvedValue(undefined),
    };

    AppSession.findOne.mockResolvedValue(appSession);
    User.findByPk.mockResolvedValue(user);

    const response = await request(app)
      .get('/protected')
      .set('Cookie', `${SESSION_COOKIE}=${VALID_SESSION_ID}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, userId: 'user-1' });
    expect(AppSession.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({
        sessionIdHash: hashSessionId(VALID_SESSION_ID),
        revokedAt: null,
      }),
    });
    expect(appSession.update).toHaveBeenCalledWith({
      lastSeenAt: expect.any(Date),
    });
  });

  it('rejects API JWTs with the wrong token use', async () => {
    const user = buildUser();
    const token = jwt.sign(
      {
        sub: user.auth0Id,
        tokenUse: 'refresh',
        user: { id: user.id, email: user.email, auth0Id: user.auth0Id },
      },
      process.env.API_JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .set(SESSION_HEADER, VALID_SESSION_ID);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('rejects tampered API JWTs before loading a user', async () => {
    const user = buildUser();
    const token = jwt.sign(
      {
        sub: user.auth0Id,
        tokenUse: 'api',
        user: { id: user.id, email: user.email, auth0Id: user.auth0Id },
      },
      'wrong-secret',
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .set(SESSION_HEADER, VALID_SESSION_ID);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('requires the app session header on protected routes', async () => {
    const user = buildUser();
    const apiToken = signApiToken(user);

    User.findOne.mockResolvedValue(user);

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${apiToken}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: SESSION_REVOKED_CODE,
      message: 'Missing app session',
    });
  });

  it('rejects low-entropy session ids on protected routes', async () => {
    const user = buildUser();
    const apiToken = signApiToken(user);

    User.findOne.mockResolvedValue(user);

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, 'session-1');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: SESSION_REVOKED_CODE,
      message: 'Invalid app session',
    });
  });

  it('does not accept session ids from the request body for protected routes', async () => {
    const user = buildUser();
    const apiToken = signApiToken(user);

    User.findOne.mockResolvedValue(user);

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${apiToken}`)
      .send({ sessionId: VALID_SESSION_ID });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: SESSION_REVOKED_CODE,
      message: 'Missing app session',
    });
  });

  it('rejects protected routes when the session id does not match the active session', async () => {
    const user = buildUser({
      activeSessionIdHash: hashSessionId(VALID_SESSION_ID),
    });
    const apiToken = signApiToken(user);

    User.findOne.mockResolvedValue(user);

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, OTHER_SESSION_ID);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: SESSION_REVOKED_CODE,
      message: 'Session revoked',
    });
  });

  it('accepts Auth0 RS256 token on app session routes', async () => {
    const user = buildUser();

    User.findOne.mockResolvedValue(user);

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${buildRs256LikeToken()}`)
      .set(SESSION_HEADER, VALID_SESSION_ID);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, userId: 'user-1' });
  });

  it('replaces a different active session by default', async () => {
    const user = buildUser({
      activeSessionIdHash: hashSessionId(OTHER_SESSION_ID),
    });
    const revokeUserSessionsExcept = jest.fn();

    app.set('revokeUserSessionsExcept', revokeUserSessionsExcept);
    User.findOne.mockResolvedValue(user);
    User.findByPk.mockResolvedValue(user);

    const response = await request(app)
      .post('/sessions/start')
      .set('Authorization', 'Bearer valid-auth0-token');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSessionIdHash: expect.any(String),
      })
    );
    expect(revokeUserSessionsExcept).toHaveBeenCalledWith(
      'user-1',
      expect.any(String)
    );
  });

  it('handles SESSION_CONFLICT when replacing a session is explicitly disabled', async () => {
    const user = buildUser({
      activeSessionIdHash: hashSessionId(OTHER_SESSION_ID),
    });

    User.findOne.mockResolvedValue(user);
    User.findByPk.mockResolvedValue(user);

    const response = await request(app)
      .post('/sessions/start')
      .set('Authorization', 'Bearer valid-auth0-token')
      .send({ force: false });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      ok: false,
      code: SESSION_CONFLICT_CODE,
      errors: ['session_conflict'],
    });
    expect(user.update).not.toHaveBeenCalled();
  });

  it('allows force login to replace the active session', async () => {
    const user = buildUser({
      activeSessionIdHash: hashSessionId(OTHER_SESSION_ID),
    });
    const revokeUserSessionsExcept = jest.fn();

    app.set('revokeUserSessionsExcept', revokeUserSessionsExcept);
    User.findOne.mockResolvedValue(user);
    User.findByPk.mockResolvedValue(user);

    const response = await request(app)
      .post('/sessions/start')
      .set('Authorization', 'Bearer valid-auth0-token')
      .send({ force: true });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSessionIdHash: expect.any(String),
      })
    );
    expect(revokeUserSessionsExcept).toHaveBeenCalledWith(
      'user-1',
      expect.any(String)
    );
  });

  it('logs out by clearing the active session', async () => {
    const user = buildUser();
    const apiToken = signApiToken(user);

    User.findOne.mockResolvedValue(user);

    const response = await request(app)
      .post('/sessions/logout')
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, VALID_SESSION_ID);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(user.update).toHaveBeenCalledWith({
      activeSessionIdHash: null,
      activeSessionStartedAt: null,
    });
  });

  it('does not clear a different active session during logout', async () => {
    const user = buildUser({
      activeSessionIdHash: hashSessionId(OTHER_SESSION_ID),
    });
    const apiToken = signApiToken(user);

    User.findOne.mockResolvedValue(user);

    const response = await request(app)
      .post('/sessions/logout')
      .set('Authorization', `Bearer ${apiToken}`)
      .set(SESSION_HEADER, VALID_SESSION_ID);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: SESSION_REVOKED_CODE,
      message: 'Session revoked',
    });
    expect(user.update).not.toHaveBeenCalled();
  });

  it('requires auth for protected routes', async () => {
    const response = await request(app)
      .get('/protected')
      .set(SESSION_HEADER, VALID_SESSION_ID);

    expect(response.status).toBe(401);
  });
});
