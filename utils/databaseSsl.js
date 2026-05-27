const fs = require('fs');
const path = require('path');

const LOCAL_ENVS = new Set(['development', 'test']);
const CA_CERT_ENV_KEYS = [
  'DB_CA_CERT',
  'DATABASE_CA_CERT',
  'DB_SSL_CA',
  'PGSSLROOTCERT_CONTENT',
];
const CA_CERT_PATH_ENV_KEYS = [
  'DB_CA_CERT_PATH',
  'DATABASE_CA_CERT_PATH',
  'DB_SSL_CA_PATH',
  'PGSSLROOTCERT',
];

const normalizePem = (value) => String(value).replace(/\\n/g, '\n').trim();

const getInlineCaBundle = () => {
  const value = CA_CERT_ENV_KEYS.map((key) => process.env[key]).find(Boolean);
  return value ? normalizePem(value) : null;
};

const getCaBundleFromPath = () => {
  const caPath = CA_CERT_PATH_ENV_KEYS.map((key) => process.env[key]).find(
    Boolean
  );

  if (!caPath) return null;

  const resolvedPath = path.resolve(caPath);
  return fs.readFileSync(resolvedPath, 'utf8').trim();
};

const getDatabaseCaBundle = () => getInlineCaBundle() || getCaBundleFromPath();

const getDatabaseDialectOptions = (env = process.env.NODE_ENV) => {
  if (LOCAL_ENVS.has(env)) {
    return { ssl: false };
  }

  const ca = getDatabaseCaBundle();

  if (!ca) {
    throw new Error(
      'Database CA bundle is required for SSL verification outside development/test'
    );
  }

  return {
    ssl: {
      require: true,
      rejectUnauthorized: true,
      ca,
    },
  };
};

module.exports = {
  getDatabaseCaBundle,
  getDatabaseDialectOptions,
};
