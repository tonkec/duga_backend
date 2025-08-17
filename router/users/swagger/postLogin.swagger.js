/**
 * @swagger
 * /auth/post-login:
 *   post:
 *     summary: Upsert user after login and mark onboarding as done
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - age
 *               - acceptPrivacy
 *               - acceptTerms
 *             properties:
 *               username:
 *                 type: string
 *                 example: duga_user
 *               age:
 *                 type: integer
 *                 example: 21
 *               acceptPrivacy:
 *                 type: boolean
 *                 example: true
 *               acceptTerms:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: User created/updated successfully
 *       400:
 *         description: Invalid input (missing or invalid fields)
 *       401:
 *         description: Unauthorized (missing or invalid JWT)
 *       500:
 *         description: Server error
 */
