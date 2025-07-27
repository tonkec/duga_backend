/**
 * @swagger
 * /send-verification-email:
 *   post:
 *     summary: Send email verification to user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       403:
 *         description: Forbidden
 */