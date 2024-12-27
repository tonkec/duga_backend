'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
 up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'spirituality', {
      type: Sequelize.TEXT, 
      allowNull: true, 
    });
  },


  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'spirituality');
  },

};
