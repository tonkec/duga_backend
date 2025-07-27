/**
 * @swagger
 * /uploads/files/*:
 *   get:
 *     summary: Stream image files from S3 bucket
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: File stream initiated
 *       404:
 *         description: File not found in DB
 */