const crypto = require('crypto');
const { Sequelize, DataTypes } = require('sequelize');
const defineMessage = require('../models/message');
const {
  decryptMessage,
  encryptMessage,
  isEncryptedMessage,
} = require('../utils/messageEncryption');

describe('Message model encryption', () => {
  let originalKey;
  let sequelize;
  let Message;

  beforeEach(() => {
    originalKey = process.env.MESSAGE_ENCRYPTION_KEY;
    process.env.MESSAGE_ENCRYPTION_KEY = crypto
      .randomBytes(32)
      .toString('base64');
    sequelize = new Sequelize('postgres://user:pass@localhost:5432/test', {
      dialect: 'postgres',
      logging: false,
    });
    Message = defineMessage(sequelize, DataTypes);
  });

  afterEach(async () => {
    if (originalKey === undefined) {
      delete process.env.MESSAGE_ENCRYPTION_KEY;
    } else {
      process.env.MESSAGE_ENCRYPTION_KEY = originalKey;
    }
    await sequelize.close();
  });

  it('encrypts raw message storage and decrypts reads', () => {
    const message = Message.build({ message: 'Hello encrypted world' });
    const rawMessage = message.getDataValue('message');

    expect(rawMessage).not.toBe('Hello encrypted world');
    expect(isEncryptedMessage(rawMessage)).toBe(true);
    expect(message.message).toBe('Hello encrypted world');
  });

  it('keeps legacy plaintext readable', () => {
    const message = Message.build();
    message.setDataValue('message', 'Legacy plaintext');

    expect(message.message).toBe('Legacy plaintext');
  });

  it('does not encrypt when MESSAGE_ENCRYPTION_KEY is missing', () => {
    delete process.env.MESSAGE_ENCRYPTION_KEY;

    expect(encryptMessage('Plain local message')).toBe('Plain local message');
    expect(decryptMessage('Plain local message')).toBe('Plain local message');
  });
});
