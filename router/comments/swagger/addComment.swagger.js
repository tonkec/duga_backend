/**
 * @swagger
 * /comments/add-comment:
 *   post:
 *     summary: Add a comment to an upload
 *     tags: [PhotoComments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               uploadId:
 *                 type: string
 *               comment:
 *                 type: string
 *               taggedUserIds:
 *                 type: string
 *                 description: JSON stringified array of user IDs
 *               commentImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Comment created
 *       400:
 *         description: Bad request or image too large
 *       500:
 *         description: Server error
 */