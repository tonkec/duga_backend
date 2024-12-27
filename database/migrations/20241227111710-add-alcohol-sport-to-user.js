'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'alcohol', {
      type: Sequelize.BOOLEAN,
      allowNull: true,    
    });

    await queryInterface.addColumn('Users', 'sport', {
      type: Sequelize.BOOLEAN,
      allowNull: true,  
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'alcohol');
    await queryInterface.removeColumn('Users', 'sport');
  },
};
