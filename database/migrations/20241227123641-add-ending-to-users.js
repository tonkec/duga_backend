'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'ending', {
      type: Sequelize.TEXT, 
      allowNull: true, 
    });
  },


  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'ending');
  },
};
