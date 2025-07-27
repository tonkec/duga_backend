/**
 * @swagger
 * /uploads/photo/{id}:
 *   get:
 *     summary: Get a single upload by ID with secure URL
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
 *         description: Upload data with secure URL
 */