process.env.APP_URL = 'http://localhost';
process.env.APP_PORT = '3000';

const crypto = require('crypto');
const { Sequelize, DataTypes } = require('sequelize');
const defineUser = require('../models/user');
const { isEncryptedMessage } = require('../utils/messageEncryption');

describe('User model', () => {
  let sequelize;
  let User;

  beforeEach(() => {
    sequelize = new Sequelize('postgres://user:pass@localhost:5432/test', {
      dialect: 'postgres',
      logging: false,
    });
    User = defineUser(sequelize, DataTypes);
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('defines expected identity and profile fields', () => {
    expect(User.rawAttributes).toEqual(
      expect.objectContaining({
        email: expect.objectContaining({
          allowNull: false,
          unique: true,
        }),
        username: expect.objectContaining({
          allowNull: true,
          unique: true,
        }),
        auth0Id: expect.objectContaining({
          allowNull: true,
          unique: true,
        }),
        firstName: expect.any(Object),
        lastName: expect.any(Object),
        bio: expect.any(Object),
        favoriteSong: expect.objectContaining({
          type: expect.any(DataTypes.TEXT),
        }),
        favoriteMovie: expect.objectContaining({
          type: expect.any(DataTypes.TEXT),
        }),
        avatar: expect.any(Object),
      })
    );
  });

  it('validates email format at the model level', () => {
    expect(User.rawAttributes.email.validate).toEqual({ isEmail: true });
  });

  it('sets safe defaults for status, onboarding, and legal acceptance fields', () => {
    const user = User.build({
      email: 'user@example.com',
    });

    expect(user.status).toBe('offline');
    expect(user.onboarding_done).toBe(false);
    expect(user.accept_privacy).toBeNull();
    expect(user.accept_terms).toBeNull();
  });

  it('returns fallback avatar when user has no avatar', () => {
    const user = User.build({
      email: 'user@example.com',
      avatar: null,
    });

    expect(user.avatar).toBe('http://placekitten.com/200/300');
  });

  it('returns public avatar URL when avatar is set', () => {
    const user = User.build({
      email: 'user@example.com',
      avatar: 'avatar.jpg',
    });

    expect(user.avatar).toBe('http://localhost:3000/user/avatar.jpg');
  });

  it('encrypts personal profile answer fields and decrypts reads', () => {
    const originalKey = process.env.MESSAGE_ENCRYPTION_KEY;
    process.env.MESSAGE_ENCRYPTION_KEY = crypto
      .randomBytes(32)
      .toString('base64');

    try {
      const user = User.build({
        email: 'user@example.com',
        bio: 'Private bio',
        spirituality: 'Private spirituality answer',
        favoriteMovie: 'Private movie answer',
      });

      expect(user.getDataValue('bio')).not.toBe('Private bio');
      expect(user.getDataValue('spirituality')).not.toBe(
        'Private spirituality answer'
      );
      expect(user.getDataValue('favoriteMovie')).not.toBe(
        'Private movie answer'
      );
      expect(isEncryptedMessage(user.getDataValue('bio'))).toBe(true);
      expect(user.bio).toBe('Private bio');
      expect(user.spirituality).toBe('Private spirituality answer');
      expect(user.favoriteMovie).toBe('Private movie answer');
    } finally {
      if (originalKey === undefined) {
        delete process.env.MESSAGE_ENCRYPTION_KEY;
      } else {
        process.env.MESSAGE_ENCRYPTION_KEY = originalKey;
      }
    }
  });

  it('keeps legacy plaintext profile answers readable', () => {
    const user = User.build({ email: 'user@example.com' });
    user.setDataValue('bio', 'Legacy plaintext bio');

    expect(user.bio).toBe('Legacy plaintext bio');
  });

  it('defines user associations', () => {
    const belongsToManySpy = jest
      .spyOn(User, 'belongsToMany')
      .mockImplementation(() => {});
    const hasManySpy = jest.spyOn(User, 'hasMany').mockImplementation(() => {});
    const hasOneSpy = jest.spyOn(User, 'hasOne').mockImplementation(() => {});

    User.associate({
      Chat: {},
      ChatUser: {},
      VerificationToken: {},
      PhotoComment: {},
      CommentMention: {},
    });

    expect(belongsToManySpy).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        through: 'ChatUser',
        foreignKey: 'userId',
      })
    );
    expect(hasManySpy).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        as: 'photoComments',
        foreignKey: 'userId',
      })
    );
    expect(hasOneSpy).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        as: 'verificationtoken',
        foreignKey: 'userId',
      })
    );

    belongsToManySpy.mockRestore();
    hasManySpy.mockRestore();
    hasOneSpy.mockRestore();
  });
});
