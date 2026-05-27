'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AppSession extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        as: 'user',
        foreignKey: 'userId',
      });
    }
  }

  AppSession.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      auth0Id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sessionIdHash: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      csrfTokenHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      rotationVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      rotatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'AppSession',
      indexes: [
        {
          unique: true,
          fields: ['sessionIdHash'],
        },
        {
          fields: ['auth0Id'],
        },
        {
          fields: ['userId'],
        },
        {
          fields: ['expiresAt'],
        },
      ],
    }
  );

  return AppSession;
};
