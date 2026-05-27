const {
  allowHttpCorsOrigin,
  allowSocketOrigin,
  isOriginAllowed,
  normalizeOrigin,
} = require('../utils/originAllowlist');

describe('origin allowlist', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ALLOWED_ORIGINS =
      'https://app.example.com, capacitor://localhost';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normalizes origins before matching', () => {
    expect(normalizeOrigin('https://app.example.com/path')).toBe(
      'https://app.example.com'
    );
    expect(isOriginAllowed('https://app.example.com/anywhere')).toBe(true);
  });

  it('allows HTTP CORS requests without an origin header', () => {
    const callback = jest.fn();

    allowHttpCorsOrigin(undefined, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects unknown HTTP origins', () => {
    const callback = jest.fn();

    allowHttpCorsOrigin('https://evil.example.com', callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  it('allows socket connections from configured origins', () => {
    const callback = jest.fn();

    allowSocketOrigin('capacitor://localhost', callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects socket connections from unknown or missing origins', () => {
    const unknownCallback = jest.fn();
    const missingCallback = jest.fn();

    allowSocketOrigin('https://evil.example.com', unknownCallback);
    allowSocketOrigin(undefined, missingCallback);

    expect(unknownCallback).toHaveBeenCalledWith(expect.any(Error), false);
    expect(missingCallback).toHaveBeenCalledWith(expect.any(Error), false);
  });
});
