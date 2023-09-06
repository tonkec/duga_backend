'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PhotoLikes extends Model {
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
      this.belongsTo(models.Upload, {
        as: 'upload',
        foreignKey: 'photoId',
        foreignKeyConstraint: true,
      });
    }
  }
  PhotoLikes.init(
    {
      count: DataTypes.NUMBER,
      userId: DataTypes.NUMBER,
      photoId: DataTypes.NUMBER,
    },
    {
      sequelize,
      modelName: 'PhotoLikes',
    }
  );
  return PhotoLikes;
};
