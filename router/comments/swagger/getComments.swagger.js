/**
 * @swagger
 * /comments/get-comments/{uploadId}:
 *   get:
 *     summary: Get all comments for a specific upload
 *     tags: [PhotoComments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: uploadId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of comments
 *       500:
 *         description: Server error
 */