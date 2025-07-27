/**
 * @swagger
 * /users/online-status:
 *   get:
 *     summary: Get the online status of users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Online status info
 *       401:
 *         description: Unauthorized
 */