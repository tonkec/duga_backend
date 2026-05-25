/**
 * @swagger
 * /uploads/files/*:
 *   get:
 *     summary: Stream image files from S3 bucket
 *     tags: [Uploads]
 *     parameters:
 *       - in: query
 *         name: access_token
 *         schema:
 *           type: string
 *         description: Auth0 JWT (for img/video tags that cannot send Authorization header)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: File stream initiated
 *       404:
 *         description: File not found in DB
 */
