/**
 * @swagger
 * /uploads/user-photos:
 *   get:
 *     summary: Get all images uploaded, commented, or messaged by user
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Combined list of user photos
 */