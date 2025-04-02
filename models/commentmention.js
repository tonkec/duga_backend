'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CommentMention extends Model {
    static associate(models) {
    }
  }

  CommentMention.init(
    {
      commentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'CommentMention',
    }
  );

  return CommentMention;
};
