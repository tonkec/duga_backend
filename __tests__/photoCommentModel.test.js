const crypto = require('crypto');
const { Sequelize, DataTypes } = require('sequelize');
const definePhotoComment = require('../models/photocomment');
const { isEncryptedMessage } = require('../utils/messageEncryption');

describe('PhotoComment model encryption', () => {
  let originalKey;
  let sequelize;
  let PhotoComment;

  beforeEach(() => {
    originalKey = process.env.MESSAGE_ENCRYPTION_KEY;
    process.env.MESSAGE_ENCRYPTION_KEY = crypto
      .randomBytes(32)
      .toString('base64');
    sequelize = new Sequelize('postgres://user:pass@localhost:5432/test', {
      dialect: 'postgres',
      logging: false,
    });
    PhotoComment = definePhotoComment(sequelize, DataTypes);
  });

  afterEach(async () => {
    if (originalKey === undefined) {
      delete process.env.MESSAGE_ENCRYPTION_KEY;
    } else {
      process.env.MESSAGE_ENCRYPTION_KEY = originalKey;
    }
    await sequelize.close();
  });

  it('encrypts raw comment storage and decrypts reads', () => {
    const comment = PhotoComment.build({
      userId: 1,
      uploadId: 101,
      comment: 'Private photo comment',
    });
    const rawComment = comment.getDataValue('comment');

    expect(rawComment).not.toBe('Private photo comment');
    expect(isEncryptedMessage(rawComment)).toBe(true);
    expect(comment.comment).toBe('Private photo comment');
  });

  it('keeps legacy plaintext comments readable', () => {
    const comment = PhotoComment.build({ userId: 1, uploadId: 101 });
    comment.setDataValue('comment', 'Legacy plaintext comment');

    expect(comment.comment).toBe('Legacy plaintext comment');
  });
});
