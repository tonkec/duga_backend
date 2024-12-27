'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcrypt');
const { config } = require('dotenv');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsToMany(models.Chat, {
        through: 'ChatUser',
        foreignKey: 'userId',
      });
      this.hasMany(models.ChatUser, { foreignKey: 'userId' });
      this.hasOne(models.VerificationToken, {
        as: 'verificationtoken',
        foreignKey: 'userId',
        foreignKeyConstraint: true,
      });
    }
  }
  User.init(
    {
      firstName: DataTypes.STRING,
      lookingFor: {
        type: DataTypes.ENUM('friendship', 'date', 'marriage', 'relationship', "partnership", "nothing", "idk"),
          allowNull: true,
      },
      relationshipStatus: {
        type: DataTypes.ENUM(
          'single',
          'relationship',
          'marriage',
          'partnership',
          'inbetween',
          'idk',
          'divorced',
          'widowed',
          'separated',
          'open',
          'engaged'
        ),
        allowNull: true,  
      },
      cigarettes: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      alcohol: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      sport: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      favoriteDayOfWeek: {
        type: DataTypes.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
        allowNull: true,  
      },
      lastName: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      gender: DataTypes.STRING,
      isVerified: DataTypes.BOOLEAN,
      bio: DataTypes.TEXT,
      sexuality: DataTypes.STRING,
      location: DataTypes.STRING,
      age: DataTypes.INTEGER,
      username: DataTypes.STRING,
      avatar: {
        type: DataTypes.STRING,
        get() {
          const avatar = this.getDataValue('avatar');
          const url = `${config.appUrl}:${config.appPort}`;
          if (!avatar) {
            return 'http://placekitten.com/200/300';
          }

          return `${url}/user/${avatar}`;
        },
      },
    },
    {
      sequelize,
      modelName: 'User',
      hooks: {
        beforeCreate: hashPassword,
        beforeUpdate: hashPassword,
      },
    }
  );
  return User;
};

const hashPassword = async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
  return user;
};
