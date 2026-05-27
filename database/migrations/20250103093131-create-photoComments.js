'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Intentionally left as a no-op. The canonical table is created by
    // 20250103094036-create-PhotoComments.js using Sequelize's expected
    // "PhotoComments" casing. Creating "photoComments" here caused
    // case-sensitive schema drift in Postgres.
  },

  down: async (queryInterface, Sequelize) => {
    // No-op for the same reason as up: never drop a differently-cased table.
  },
};
