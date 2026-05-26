'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'
    );

    await queryInterface.addColumn('Users', 'publicId', {
      type: Sequelize.UUID,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'publicId');
  },
};
