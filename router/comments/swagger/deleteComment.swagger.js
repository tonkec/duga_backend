/**
 * @swagger
 * /comments/delete-comment/{id}:
 *   delete:
 *     summary: Delete a specific comment and its image (if exists)
 *     tags: [PhotoComments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 *       500:
 *         description: Server error
 */