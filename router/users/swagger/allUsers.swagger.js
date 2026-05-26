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
 *         description: List of all users. Each user includes publicId.
 *       401:
 *         description: Unauthorized
 */
