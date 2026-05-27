'use strict';

const TABLE_NAME = 'UserFollowers';

const hasTable = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const tableName = typeof table === 'object' ? table.tableName : table;
    return tableName === TABLE_NAME;
  });
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    if (await hasTable(queryInterface)) {
      await queryInterface.dropTable(TABLE_NAME);
    }
  },

  async down(queryInterface, Sequelize) {
    if (await hasTable(queryInterface)) {
      return;
    }

    await queryInterface.createTable(TABLE_NAME, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      followerId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
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
};
