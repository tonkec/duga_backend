/**
 * @swagger
 * /likes/all-likes/{photoId}:
 *   get:
 *     summary: Get all likes for a specific photo
 *     tags: [PhotoLikes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: photoId
 *         in: path
 *         required: true
 *         description: ID of the photo
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of users who liked the photo
 *       500:
 *         description: Server error
 */