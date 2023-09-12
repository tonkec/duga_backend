'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserFollower extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here

      this.belongsTo(models.User, {
        as: 'user',
        foreignKey: 'userId',
        foreignKeyConstraint: true,
      });

      this.belongsTo(models.User, {
        as: 'follower',
        foreignKey: 'followerId',
        foreignKeyConstraint: true,
      });
    }
  }
  UserFollower.init(
    {
      userId: DataTypes.INTEGER,
      followerId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'UserFollower',
    }
  );
  return UserFollower;
};
