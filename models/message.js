'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Chat, { foreignKey: 'chatId' });
      this.belongsTo(models.User, { foreignKey: 'fromUserId' });
    }
  }
  Message.init(
    {
      chatId: DataTypes.INTEGER,
      fromUserId: DataTypes.INTEGER,
      type: DataTypes.STRING,
      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        get() {
          const content = this.getDataValue('message');
          return content
        },
      },
      messagePhotoUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Message',
    }
  );
  return Message;
};
