'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DELETE FROM "Users"
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY username ORDER BY id ASC) AS row_num
          FROM "Users"
        ) sub
        WHERE sub.row_num > 1
      );
    `);

  },

  async down(queryInterface) {
  },
};
