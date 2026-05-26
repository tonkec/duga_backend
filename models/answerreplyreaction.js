'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AnswerReplyReaction extends Model {
    static associate(models) {
      this.belongsTo(models.AnswerReply, {
        as: 'reply',
        foreignKey: 'answerReplyId',
      });
      this.belongsTo(models.User, {
        as: 'user',
        foreignKey: 'userId',
      });
    }
  }

  AnswerReplyReaction.init(
    {
      answerReplyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      emoji: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'AnswerReplyReaction',
    }
  );

  return AnswerReplyReaction;
};
