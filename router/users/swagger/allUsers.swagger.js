/**
 * @swagger
 * /users/get-users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users with public profile identifiers only.
 *       401:
 *         description: Unauthorized
 */
