'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MessageMentions', {
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
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addConstraint('MessageMentions', {
      fields: ['messageId', 'userId'],
      type: 'unique',
      name: 'message_mentions_message_id_user_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MessageMentions');
  },
};
