'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AnswerReaction extends Model {
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

  AnswerReaction.init(
    {
      answerId: {
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
      modelName: 'AnswerReaction',
    }
  );

  return AnswerReaction;
};
