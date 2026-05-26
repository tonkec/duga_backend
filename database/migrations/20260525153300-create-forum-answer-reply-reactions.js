'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AnswerReplyReactions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      answerReplyId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'AnswerReplies',
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
      emoji: {
        allowNull: false,
        type: Sequelize.STRING(32),
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

    await queryInterface.addConstraint('AnswerReplyReactions', {
      fields: ['answerReplyId', 'userId', 'emoji'],
      type: 'unique',
      name: 'answer_reply_reactions_reply_id_user_id_emoji_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AnswerReplyReactions');
  },
};
