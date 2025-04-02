'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint('CommentMentions', {
      fields: ['commentId'],
      type: 'foreign key',
      name: 'fk_commentmentions_comment',
      references: {
        table: 'PhotoComments',
        field: 'id',
      },
      onDelete: 'CASCADE',
    });

    await queryInterface.addConstraint('CommentMentions', {
      fields: ['userId'],
      type: 'foreign key',
      name: 'fk_commentmentions_user',
      references: {
        table: 'Users',
        field: 'id',
      },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('CommentMentions', 'fk_commentmentions_comment');
    await queryInterface.removeConstraint('CommentMentions', 'fk_commentmentions_user');
  },
};
