/**
 * @swagger
 * /send-verification-email:
 *   post:
 *     summary: Send email verification to user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *     responses:
 *       200:
 *         description: Verification email sent
 *       401:
 *         description: Missing or invalid Auth0 token
 *       429:
 *         description: Verification email recently sent
 */
