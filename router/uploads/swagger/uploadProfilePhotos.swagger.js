/**
 * @swagger
 * /uploads/photos:
 *   post:
 *     summary: Upload user photos with descriptions
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatars:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Upload and metadata update successful
 */