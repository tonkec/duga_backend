'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'lookingFor', {
      type: Sequelize.ENUM('friendship', 'date', 'marriage', 'relationship', "partnership", "nothing", "idk"),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'lookingFor');
    await queryInterface.sequelize.query('DROP TYPE "enum_Users_lookingFor";');
  }  
};
