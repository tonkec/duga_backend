'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Delete duplicates, keeping the first per username
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

    // No need to add the constraint again
  },

  async down(queryInterface) {
    // Optional: no-op, or log that duplicates were removed
  },
};
