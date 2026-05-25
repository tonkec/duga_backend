'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AnswerReply extends Model {
    static associate(models) {
      this.belongsTo(models.Answer, {
        as: 'answer',
        foreignKey: 'answerId',
      });
      this.belongsTo(models.User, {
        as: 'user',
        foreignKey: 'userId',
      });
    }
  }

  AnswerReply.init(
    {
      answerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'AnswerReply',
    }
  );

  return AnswerReply;
};
