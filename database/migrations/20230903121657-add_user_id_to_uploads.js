'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.addColumn('Uploads', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      onUpdate: 'cascade',
      onDelete: 'cascade',
      references: { model: 'Users', key: 'id' },
    });
  },
  async down(queryInterface, Sequelize) {
    return queryInterface.removeColumn('Uploads', 'userId');
  },
};
