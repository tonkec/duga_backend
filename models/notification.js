'use strict';
const { Model } = require('sequelize');
const {
  decryptMessage,
  encryptMessage,
} = require('../utils/messageEncryption');
module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.User, { foreignKey: 'userId' });
      this.belongsTo(models.Chat, { foreignKey: 'chatId' });
    }
  }
  Notification.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      type: DataTypes.STRING,
      content: {
        type: DataTypes.STRING,
        allowNull: false,
        get() {
          return decryptMessage(this.getDataValue('content'));
        },
        set(value) {
          this.setDataValue('content', encryptMessage(value));
        },
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      actionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      actionType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      chatId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Chats',
          key: 'id',
        },
      },
    },
    {
      sequelize,
      modelName: 'Notification',
    }
  );
  return Notification;
};
