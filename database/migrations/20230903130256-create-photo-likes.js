'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PhotoLikes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      count: {
        type: Sequelize.INTEGER,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        onUpdate: 'cascade',
        onDelete: 'cascade',
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      photoId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        onUpdate: 'cascade',
        onDelete: 'cascade',
        references: {
          model: 'Uploads',
          key: 'id',
        },
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PhotoLikes');
  },
};
