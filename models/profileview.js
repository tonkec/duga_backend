'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProfileView extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        as: 'viewer',
        foreignKey: 'viewerId',
      });
      this.belongsTo(models.User, {
        as: 'viewedUser',
        foreignKey: 'viewedUserId',
      });
    }
  }

  ProfileView.init(
    {
      viewerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      viewedUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'ProfileView',
    }
  );

  return ProfileView;
};
