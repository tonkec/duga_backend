'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          DELETE FROM "PhotoLikes"
          WHERE id IN (
            SELECT id
            FROM (
              SELECT
                id,
                ROW_NUMBER() OVER (
                  PARTITION BY "photoId", "userId"
                  ORDER BY id ASC
                ) AS row_num
              FROM "PhotoLikes"
            ) duplicates
            WHERE duplicates.row_num > 1
          );
        `,
        { transaction }
      );

      await queryInterface.addConstraint('PhotoLikes', {
        fields: ['photoId', 'userId'],
        type: 'unique',
        name: 'photo_likes_unique_photo_user',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      'PhotoLikes',
      'photo_likes_unique_photo_user'
    );
  },
};
