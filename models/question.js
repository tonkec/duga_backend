'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Question extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        as: 'user',
        foreignKey: 'userId',
      });
      this.belongsTo(models.Category, {
        as: 'category',
        foreignKey: 'categoryId',
      });
      this.hasMany(models.Answer, {
        as: 'answers',
        foreignKey: 'questionId',
        onDelete: 'CASCADE',
      });
      this.hasMany(models.QuestionVote, {
        as: 'votes',
        foreignKey: 'questionId',
        onDelete: 'CASCADE',
      });
    }
  }

  Question.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      isResolved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Question',
    }
  );

  return Question;
};
