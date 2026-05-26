const crypto = require('crypto');
const { Sequelize, DataTypes } = require('sequelize');
const defineNotification = require('../models/notification');
const { isEncryptedMessage } = require('../utils/messageEncryption');

describe('Notification model encryption', () => {
  let originalKey;
  let sequelize;
  let Notification;

  beforeEach(() => {
    originalKey = process.env.MESSAGE_ENCRYPTION_KEY;
    process.env.MESSAGE_ENCRYPTION_KEY = crypto
      .randomBytes(32)
      .toString('base64');
    sequelize = new Sequelize('postgres://user:pass@localhost:5432/test', {
      dialect: 'postgres',
      logging: false,
    });
    Notification = defineNotification(sequelize, DataTypes);
  });

  afterEach(async () => {
    if (originalKey === undefined) {
      delete process.env.MESSAGE_ENCRYPTION_KEY;
    } else {
      process.env.MESSAGE_ENCRYPTION_KEY = originalKey;
    }
    await sequelize.close();
  });

  it('encrypts raw notification content and decrypts reads', () => {
    const notification = Notification.build({
      userId: 1,
      type: 'message',
      content: 'Private notification content',
    });
    const rawContent = notification.getDataValue('content');

    expect(rawContent).not.toBe('Private notification content');
    expect(isEncryptedMessage(rawContent)).toBe(true);
    expect(notification.content).toBe('Private notification content');
  });

  it('keeps legacy plaintext notifications readable', () => {
    const notification = Notification.build({
      userId: 1,
      type: 'message',
      content: 'Initial content',
    });
    notification.setDataValue('content', 'Legacy plaintext notification');

    expect(notification.content).toBe('Legacy plaintext notification');
  });
});
