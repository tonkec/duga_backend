'use strict';

const TABLE_NAME = 'MessageReads';

const hasColumn = async (queryInterface, tableName, columnName) => {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table[columnName]);
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      messageId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'Messages',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      readAt: {
        allowNull: false,
        type: Sequelize.DATE,
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

    await queryInterface.addIndex(TABLE_NAME, ['messageId', 'userId'], {
      unique: true,
      name: 'message_reads_message_user_unique',
    });
    await queryInterface.addIndex(TABLE_NAME, ['userId']);

    if (await hasColumn(queryInterface, 'Messages', 'is_read')) {
      await queryInterface.removeColumn('Messages', 'is_read');
    }
  },

  async down(queryInterface, Sequelize) {
    if (!(await hasColumn(queryInterface, 'Messages', 'is_read'))) {
      await queryInterface.addColumn('Messages', 'is_read', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    await queryInterface.dropTable(TABLE_NAME);
  },
};
