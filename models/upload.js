'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Upload extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.User, {
        as: 'user',
        foreignKey: 'userId',
        foreignKeyConstraint: true,
      });
    }
  }
  Upload.init(
    {
      name: DataTypes.STRING,
      url: DataTypes.STRING,
      filetype: DataTypes.STRING,
      description: DataTypes.STRING,
      isProfilePhoto: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: 'Upload',
    }
  );
  return Upload;
};
