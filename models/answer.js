'use strict';
const { Model } = require('sequelize');
const {
  decryptMessage,
  encryptMessage,
} = require('../utils/messageEncryption');

module.exports = (sequelize, DataTypes) => {
  class Answer extends Model {
    static associate(models) {
      this.belongsTo(models.Question, {
        as: 'question',
        foreignKey: 'questionId',
      });
      this.belongsTo(models.User, {
        as: 'user',
        foreignKey: 'userId',
      });
      this.hasMany(models.AnswerReaction, {
        as: 'reactions',
        foreignKey: 'answerId',
        onDelete: 'CASCADE',
      });
      this.hasMany(models.AnswerReply, {
        as: 'replies',
        foreignKey: 'answerId',
        onDelete: 'CASCADE',
      });
    }
  }

  Answer.init(
    {
      questionId: {
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
      imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isAccepted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Answer',
    }
  );

  return Answer;
};
