/**
 * @swagger
 * /comments/update-comment/{id}:
 *   put:
 *     summary: Update a specific comment
 *     tags: [PhotoComments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *               taggedUserIds:
 *                 type: array
 *                 items:
 *                   type: number
 *     responses:
 *       200:
 *         description: Comment updated
 *       500:
 *         description: Server error
 */