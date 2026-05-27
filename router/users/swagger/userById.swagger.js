/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by internal ID or public UUID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Internal user ID or publicId UUID
 *     responses:
 *       200:
 *         description: Public user object. Excludes email and private profile fields.
 *       404:
 *         description: User not found
 */
