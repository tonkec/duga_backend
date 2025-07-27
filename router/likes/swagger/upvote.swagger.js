/**
 * @swagger
 * /likes/upvote/{id}:
 *   post:
 *     summary: Upvote (like) a photo
 *     tags: [PhotoLikes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the photo to like
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Photo liked successfully
 *       400:
 *         description: Already liked or invalid photo ID
 *       500:
 *         description: Server error
 */