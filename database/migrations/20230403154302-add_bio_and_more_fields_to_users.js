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
      queryInterface.addColumn('Users', 'bio', {
        type: Sequelize.TEXT,
      }),
      queryInterface.addColumn('Users', 'sexuality', {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Users', 'location', {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Users', 'age', {
        type: Sequelize.INTEGER,
      }),
      queryInterface.addColumn('Users', 'username', {
        type: Sequelize.STRING,
      }),
    ]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */ return Promise.all([
      queryInterface.removeColumn('Users', 'bio'),
      queryInterface.removeColumn('Users', 'sexuality'),
      queryInterface.removeColumn('Users', 'location'),
      queryInterface.removeColumn('Users', 'age'),
      queryInterface.removeColumn('Users', 'username'),
    ]);
  },
};
