"use strict";
const bcrypt = require("bcrypt");

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
          password: bcrypt.hashSync("secret", 10),
        },
        {
          firstName: "Petra",
          lastName: "Tomasic",
          gender: "F",
          email: "pero@gmail.com",
          password: bcrypt.hashSync("secret", 10),
        },
        {
          firstName: "Marley",
          lastName: "Tomasic",
          gender: "F",
          email: "marley@gmail.com",
          password: bcrypt.hashSync("secret", 10),
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
