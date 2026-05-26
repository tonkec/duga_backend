'use strict';
const { Model } = require('sequelize');
const {
  decryptMessage,
  encryptMessage,
} = require('../utils/messageEncryption');

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
      this.hasMany(models.AnswerReplyReaction, {
        as: 'reactions',
        foreignKey: 'answerReplyId',
        onDelete: 'CASCADE',
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
        get() {
          return decryptMessage(this.getDataValue('body'));
        },
        set(value) {
          this.setDataValue('body', encryptMessage(value));
        },
      },
    },
    {
      sequelize,
      modelName: 'AnswerReply',
    }
  );

  return AnswerReply;
};
