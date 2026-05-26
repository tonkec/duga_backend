'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ChatUsers', 'role', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'member',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ChatUsers', 'role');
  },
};
