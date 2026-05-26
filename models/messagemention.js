'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MessageMention extends Model {}

  MessageMention.init(
    {
      messageId: {
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
      modelName: 'MessageMention',
    }
  );

  return MessageMention;
};
