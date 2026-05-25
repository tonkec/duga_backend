process.env.APP_URL = 'http://localhost';
process.env.APP_PORT = '3000';

const { Sequelize, DataTypes } = require('sequelize');
const defineUser = require('../models/user');

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
