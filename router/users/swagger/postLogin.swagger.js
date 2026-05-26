/**
 * @swagger
 * /users/post-login:
 *   post:
 *     summary: Mark onboarding as done after login
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 required:
 *                   - username
 *                   - age
 *                   - acceptPrivacy
 *                   - acceptTerms
 *                 properties:
 *                   username:
 *                     type: string
 *                     example: duga_user
 *                   age:
 *                     type: integer
 *                     example: 21
 *                   acceptPrivacy:
 *                     type: boolean
 *                     example: true
 *                   acceptTerms:
 *                     type: boolean
 *                     example: true
 *     responses:
 *       200:
 *         description: User updated successfully. Response user includes publicId.
 *       400:
 *         description: Invalid input (missing or invalid fields)
 *       401:
 *         description: Unauthorized (missing or invalid JWT)
 *       500:
 *         description: Server error
 */
