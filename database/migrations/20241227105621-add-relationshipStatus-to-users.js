'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'relationshipStatus', {
      type: Sequelize.ENUM(
        'single',
        'relationship',
        'marriage',
        'partnership',
        'inbetween',
        'idk',
        'divorced',
        'widowed',
        'separated',
        'open',
        'engaged'
      ),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'relationshipStatus');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_relationshipStatus";'); 
  }
};
