/**
 * @swagger
 * /users/username/{username}:
 *   get:
 *     summary: Get users by username
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Username to search for
 *     responses:
 *       200:
 *         description: Matching users. Each user includes id, publicId, and username.
 */
