'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AnswerVote extends Model {
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

  AnswerVote.init(
    {
      answerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          isIn: [[-1, 1]],
        },
      },
    },
    {
      sequelize,
      modelName: 'AnswerVote',
    }
  );

  return AnswerVote;
};
