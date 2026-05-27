const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getDatabaseCaBundle,
  getDatabaseDialectOptions,
} = require('../utils/databaseSsl');

describe('database SSL configuration', () => {
  const originalEnv = { ...process.env };
  let tempDir;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DB_CA_CERT;
    delete process.env.DATABASE_CA_CERT;
    delete process.env.DB_SSL_CA;
    delete process.env.PGSSLROOTCERT_CONTENT;
    delete process.env.DB_CA_CERT_PATH;
    delete process.env.DATABASE_CA_CERT_PATH;
    delete process.env.DB_SSL_CA_PATH;
    delete process.env.PGSSLROOTCERT;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'duga-db-ca-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not require SSL in development or test', () => {
    expect(getDatabaseDialectOptions('development')).toEqual({ ssl: false });
    expect(getDatabaseDialectOptions('test')).toEqual({ ssl: false });
  });

  it('fails outside local environments without a CA bundle', () => {
    expect(() => getDatabaseDialectOptions('production')).toThrow(
      'Database CA bundle is required for SSL verification outside development/test'
    );
  });

  it('uses an inline provider CA bundle with certificate verification enabled', () => {
    process.env.DB_CA_CERT =
      '-----BEGIN CERTIFICATE-----\\nca\\n-----END CERTIFICATE-----';

    expect(getDatabaseDialectOptions('production')).toEqual({
      ssl: {
        require: true,
        rejectUnauthorized: true,
        ca: '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----',
      },
    });
  });

  it('loads a provider CA bundle from a configured path', () => {
    const caPath = path.join(tempDir, 'provider-ca.pem');
    fs.writeFileSync(
      caPath,
      '-----BEGIN CERTIFICATE-----\nfile-ca\n-----END CERTIFICATE-----'
    );
    process.env.DB_CA_CERT_PATH = caPath;

    expect(getDatabaseCaBundle()).toBe(
      '-----BEGIN CERTIFICATE-----\nfile-ca\n-----END CERTIFICATE-----'
    );
    expect(getDatabaseDialectOptions('staging').ssl).toMatchObject({
      require: true,
      rejectUnauthorized: true,
    });
  });
});
