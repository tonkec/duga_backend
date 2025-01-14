'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VerificationToken extends Model {
    static associate(models) {
      VerificationToken.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  }
  VerificationToken.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      token: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'VerificationToken',
    }
  );
  return VerificationToken;
};
