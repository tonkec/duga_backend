/**
 * @swagger
 * /likes/downvote/{id}:
 *   post:
 *     summary: Downvote (unlike) a photo
 *     tags: [PhotoLikes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the photo to unlike
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Photo unliked successfully
 *       400:
 *         description: Not previously liked
 *       500:
 *         description: Server error
 */