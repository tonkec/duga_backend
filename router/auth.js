const router = require('express').Router();
const User = require("./../models").User
const {
  register,
  deleteUser,
} = require('../controllers/authController');
const { sendVerificationEmail } = require('../controllers/authController');
const withAccessCheck = require("../middleware/accessCheck");
const attachCurrentUser = require('../middleware/attachCurrentUser');
const { checkJwt } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and user account operations
 */

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *             properties:
 *               email:
 *                 type: string
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 */
router.post('/register', register);

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
router.post('/send-verification-email', withAccessCheck(User), sendVerificationEmail);

/**
 * @swagger
 * /delete-user:
 *   delete:
 *     summary: Delete the currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/delete-user', [checkJwt, attachCurrentUser], deleteUser);
module.exports = router;