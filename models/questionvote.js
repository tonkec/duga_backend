'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class QuestionVote extends Model {
    static associate(models) {
      this.belongsTo(models.Question, {
        as: 'question',
        foreignKey: 'questionId',
      });
      this.belongsTo(models.User, {
        as: 'user',
        foreignKey: 'userId',
      });
    }
  }

  QuestionVote.init(
    {
      questionId: {
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
      modelName: 'QuestionVote',
    }
  );

  return QuestionVote;
};
