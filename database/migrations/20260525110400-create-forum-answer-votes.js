'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AnswerVotes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      answerId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'Answers',
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
      value: {
        allowNull: false,
        type: Sequelize.INTEGER,
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

    await queryInterface.addConstraint('AnswerVotes', {
      fields: ['answerId', 'userId'],
      type: 'unique',
      name: 'answer_votes_answer_id_user_id_unique',
    });

    await queryInterface.addConstraint('AnswerVotes', {
      fields: ['value'],
      type: 'check',
      where: {
        value: [-1, 1],
      },
      name: 'answer_votes_value_check',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AnswerVotes');
  },
};
