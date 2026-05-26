const crypto = require('crypto');

const ENCRYPTION_PREFIX = 'v1';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

const getEncryptionKey = () => {
  const rawKey = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!rawKey) return null;

  const key = Buffer.from(rawKey, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new Error('MESSAGE_ENCRYPTION_KEY must be a 32-byte base64 value');
  }

  return key;
};

const isEncryptedMessage = (value) =>
  typeof value === 'string' && value.startsWith(`${ENCRYPTION_PREFIX}:`);

const encryptMessage = (value) => {
  if (value === null || value === undefined || isEncryptedMessage(value)) {
    return value;
  }

  const key = getEncryptionKey();
  if (!key) return value;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
};

const decryptMessage = (value) => {
  if (value === null || value === undefined || !isEncryptedMessage(value)) {
    return value;
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error('MESSAGE_ENCRYPTION_KEY is required to decrypt messages');
  }

  const [, iv, authTag, ciphertext] = value.split(':');
  if (!iv || !authTag || !ciphertext) {
    throw new Error('Invalid encrypted message payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

module.exports = {
  decryptMessage,
  encryptMessage,
  isEncryptedMessage,
};
