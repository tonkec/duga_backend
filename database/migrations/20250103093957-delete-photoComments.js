'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // This migration will drop the photoComments table
    await queryInterface.dropTable('photoComments');
  },

  down: async (queryInterface, Sequelize) => {
    // If you want to re-create the table in case of rollback
    await queryInterface.createTable('photoComments', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users', // Assumes a Users table exists
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      uploadId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Uploads', // Assumes an Uploads table exists
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      comment: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },
};
