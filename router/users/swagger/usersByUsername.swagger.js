/**
 * @swagger
 * /users/by-usernames:
 *   post:
 *     tags:
 *       - Users
 *     summary: Get users by usernames
 *     description: Returns users matching an array of usernames.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - usernames
 *             properties:
 *               usernames:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["alice", "bob"]
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
