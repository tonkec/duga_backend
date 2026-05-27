'use strict';

const TABLE_NAME = 'AppSessions';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      auth0Id: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      sessionIdHash: {
        allowNull: false,
        type: Sequelize.STRING,
        unique: true,
      },
      csrfTokenHash: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      userAgent: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      ipAddress: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      expiresAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      revokedAt: {
        allowNull: true,
        type: Sequelize.DATE,
      },
      rotationVersion: {
        allowNull: false,
        defaultValue: 0,
        type: Sequelize.INTEGER,
      },
      rotatedAt: {
        allowNull: true,
        type: Sequelize.DATE,
      },
      lastSeenAt: {
        allowNull: true,
        type: Sequelize.DATE,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex(TABLE_NAME, ['auth0Id'], {
      name: 'app_sessions_auth0_id',
    });
    await queryInterface.addIndex(TABLE_NAME, ['userId'], {
      name: 'app_sessions_user_id',
    });
    await queryInterface.addIndex(TABLE_NAME, ['expiresAt'], {
      name: 'app_sessions_expires_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE_NAME);
  },
};
