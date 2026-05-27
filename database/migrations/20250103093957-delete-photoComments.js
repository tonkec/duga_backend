'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Intentionally left as a no-op. This migration used to drop the
    // lower-case "photoComments" table, which is dangerous on case-sensitive
    // databases if that table contains data from a prior deploy.
  },

  down: async (queryInterface, Sequelize) => {
    // No-op for the same reason as up: do not recreate the wrong-case table.
  },
};
