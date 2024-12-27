'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'favoriteSong', {
      type: Sequelize.STRING,
      allowNull: true, // allows null if no favorite song is provided
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'favoriteSong');
  },
};
