'use strict';

const hasTable = (tables, tableName) =>
  tables.some((table) => {
    const name = typeof table === 'string' ? table : table.tableName;
    return name === tableName;
  });

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (hasTable(tables, 'PhotoComments')) {
      return;
    }

    if (hasTable(tables, 'photoComments')) {
      await queryInterface.renameTable('photoComments', 'PhotoComments');
      return;
    }

    await queryInterface.createTable('PhotoComments', {
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
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      uploadId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Uploads',
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

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('PhotoComments');
  },
};
