'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // (optional) if you already have duplicates, fix them BEFORE adding the constraint
    // Example: set duplicates to NULL or append a suffix. Otherwise this will fail.

    await queryInterface.addConstraint("Users", {
      fields: ["username"],
      type: "unique",
      name: "unique_username_constraint",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("Users", "unique_username_constraint");
  },
};
