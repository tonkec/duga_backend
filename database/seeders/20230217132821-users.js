"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     *
     */

    await queryInterface.bulkInsert(
      "Users",
      [
        {
          firstName: "Antonija",
          lastName: "Simic",
          gender: "M",
          email: "antonija1023@gmail.com",
        },
        {
          firstName: "Petra",
          lastName: "Tomasic",
          gender: "F",
          email: "pero@gmail.com",
        },
        {
          firstName: "Marley",
          lastName: "Tomasic",
          gender: "F",
          email: "marley@gmail.com",
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete("Users", null, {});
  },
};
