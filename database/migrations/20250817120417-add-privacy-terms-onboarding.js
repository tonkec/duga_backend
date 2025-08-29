'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Users", "accept_privacy", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("Users", "accept_terms", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("Users", "onboarding_done", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });
    await queryInterface.addColumn("Users", "first_login_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Users", "accept_privacy");
    await queryInterface.removeColumn("Users", "accept_terms");
    await queryInterface.removeColumn("Users", "onboarding_done");
    await queryInterface.removeColumn("Users", "first_login_at");
  },
};
