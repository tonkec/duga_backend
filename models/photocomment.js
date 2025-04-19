'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PhotoComment extends Model {
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
        foreignKey: 'uploadId',
        foreignKeyConstraint: true,
      });
      
      this.belongsToMany(models.User, {
        through: models.CommentMention,
        as: 'taggedUsers',
        foreignKey: 'commentId',
      });
      
    }
  }
  PhotoComment.init(
    {
      userId: DataTypes.STRING,
      uploadId: DataTypes.STRING,
      comment: DataTypes.TEXT,
      imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      }
    },
    {
      sequelize,
      modelName: 'PhotoComment',
    }
  );
  return PhotoComment;
};
