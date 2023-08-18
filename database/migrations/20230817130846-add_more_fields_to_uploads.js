'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    return Promise.all([
      queryInterface.addColumn('Uploads', 'description', {
        type: Sequelize.TEXT,
      }),
      queryInterface.addColumn('Uploads', 'isProfilePhoto', {
        type: Sequelize.BOOLEAN,
      }),
    ]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    return Promise.all([
      queryInterface.removeColumn('Uploads', 'description'),
      queryInterface.removeColumn('Uploads', 'isProfilePhoto'),
    ]);
  },
};
