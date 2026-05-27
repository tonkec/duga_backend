'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuthRateLimit extends Model {}

  AuthRateLimit.init(
    {
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      key: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'AuthRateLimit',
      indexes: [
        {
          unique: true,
          fields: ['action', 'key'],
        },
        {
          fields: ['expiresAt'],
        },
      ],
    }
  );

  return AuthRateLimit;
};
