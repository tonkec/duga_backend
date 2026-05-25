'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Questions', 'imageUrl', {
      allowNull: true,
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('Answers', 'imageUrl', {
      allowNull: true,
      type: Sequelize.STRING,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Answers', 'imageUrl');
    await queryInterface.removeColumn('Questions', 'imageUrl');
  },
};
