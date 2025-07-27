/**
 * @swagger
 * /comments/latest:
 *   get:
 *     summary: Get the latest 5 comments
 *     tags: [PhotoComments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of latest comments
 *       500:
 *         description: Server error
 */