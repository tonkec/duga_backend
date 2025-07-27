/**
 * @swagger
 * /uploads/profile-photo/{id}:
 *   get:
 *     summary: Get user profile photo
 *     tags: [Uploads]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Secure profile photo URL
 */