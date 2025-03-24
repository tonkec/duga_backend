'use strict';
const {
  Model
} = require('sequelize');
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
    }
  }
  Notification.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    type: DataTypes.STRING,
    content: {
      type: DataTypes.STRING,
      allowNull: false
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    actionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actionType: {
      type: DataTypes.STRING,
      allowNull: true, 
    },
  }, {
    sequelize,
    modelName: 'Notification',
  });
  return Notification;
};