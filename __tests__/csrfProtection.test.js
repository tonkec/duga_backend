const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  AppSession: {
    findOne: jest.fn(),
  },
}));

const { AppSession } = require('../models');
const csrfProtection = require('../middleware/csrfProtection');
const {
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  hashSessionId,
} = require('../utils/appSession');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(csrfProtection);
  app.post('/unsafe', (req, res) => res.json({ ok: true }));
  app.get('/safe', (req, res) => res.json({ ok: true }));
  return app;
};

describe('csrfProtection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows safe methods without a csrf token', async () => {
    const response = await request(buildApp()).get('/safe');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(AppSession.findOne).not.toHaveBeenCalled();
  });

  it('rejects unsafe cookie-backed requests without a matching csrf header', async () => {
    const response = await request(buildApp())
      .post('/unsafe')
      .set('Cookie', `${SESSION_COOKIE}=session-value; ${CSRF_COOKIE}=csrf`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ ok: false, errors: ['csrf_failed'] });
    expect(AppSession.findOne).not.toHaveBeenCalled();
  });

  it('allows unsafe requests when csrf cookie, header, and session record match', async () => {
    AppSession.findOne.mockResolvedValue({ id: 1 });

    const response = await request(buildApp())
      .post('/unsafe')
      .set('Cookie', `${SESSION_COOKIE}=session-value; ${CSRF_COOKIE}=csrf`)
      .set(CSRF_HEADER, 'csrf');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(AppSession.findOne).toHaveBeenCalledWith({
      where: {
        sessionIdHash: hashSessionId('session-value'),
        csrfTokenHash: hashSessionId('csrf'),
        revokedAt: null,
      },
    });
  });
});
