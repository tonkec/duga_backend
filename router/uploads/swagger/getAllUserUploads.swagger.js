
/**
 * @swagger
 * /uploads/user/{id}:
 *   get:
 *     summary: Get uploads by user ID
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of uploads by user
 */