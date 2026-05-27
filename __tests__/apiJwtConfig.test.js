const {
  DEFAULT_API_JWT_EXPIRES_IN,
  getApiJwtExpiresIn,
  getApiJwtSecret,
  parseTtlSeconds,
} = require('../utils/apiJwtConfig');

describe('api JWT config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.API_JWT_SECRET;
    delete process.env.JWT_SECRET;
    delete process.env.API_JWT_EXPIRES_IN;
    delete process.env.JEST_WORKER_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fails outside tests when API_JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';

    expect(() => getApiJwtSecret()).toThrow(
      'API_JWT_SECRET is required outside test environments'
    );
  });

  it('rejects weak secrets outside tests', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_JWT_SECRET = 'short-secret';

    expect(() => getApiJwtSecret()).toThrow(
      'API_JWT_SECRET must be at least 32 bytes'
    );
  });

  it('accepts high-entropy-length secrets outside tests', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_JWT_SECRET = 'uHkWTF4yfgZ3pY88uPnqv3JfM7AbCDa9lQeX2KsR5Nw=';

    expect(getApiJwtSecret()).toBe(process.env.API_JWT_SECRET);
  });

  it('defaults API JWT lifetime to a short value', () => {
    process.env.NODE_ENV = 'production';

    expect(getApiJwtExpiresIn()).toBe(DEFAULT_API_JWT_EXPIRES_IN);
  });

  it('rejects API JWT lifetimes longer than one hour outside tests', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_JWT_EXPIRES_IN = '2h';

    expect(() => getApiJwtExpiresIn()).toThrow(
      'API_JWT_EXPIRES_IN must be 1h or shorter'
    );
  });

  it('parses supported TTL units', () => {
    expect(parseTtlSeconds('900')).toBe(900);
    expect(parseTtlSeconds('15m')).toBe(900);
    expect(parseTtlSeconds('1h')).toBe(3600);
  });
});
