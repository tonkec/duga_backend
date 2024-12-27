'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'tooOldFor', {
      type: Sequelize.TEXT, 
      allowNull: true, 
    });
  },


  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'tooOldFor');
  },
};
