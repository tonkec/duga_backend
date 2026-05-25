'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Users', 'favoriteSong', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Users', 'favoriteSong', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
