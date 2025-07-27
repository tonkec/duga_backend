const router = require('express').Router();
const {
  update,
  getAllUsers,
  getUser,
  getUsersByUsername,
  getUserOnlineStatus,
  getCurrentUser,
} = require('../controllers/usersController');
const attachCurrentUser = require('../middleware/attachCurrentUser');
const { checkJwt } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and profile operations
 */

/**
 * @swagger
 * /users/update-user:
 *   post:
 *     summary: Update the current user
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
 *               username:
 *                 type: string
 *               bio:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: User successfully updated
 *       401:
 *         description: Unauthorized
 */
router.post('/update-user', [checkJwt, attachCurrentUser], update);

/**
 * @swagger
 * /users/get-users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *       401:
 *         description: Unauthorized
 */
router.get('/get-users', [checkJwt, attachCurrentUser], getAllUsers);

/**
 * @swagger
 * /users/username/{username}:
 *   get:
 *     summary: Get users by username
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Username to search for
 *     responses:
 *       200:
 *         description: Matching users
 *       404:
 *         description: User not found
 */
router.get('/username/:username', [checkJwt, attachCurrentUser], getUsersByUsername);

/**
 * @swagger
 * /users/online-status:
 *   get:
 *     summary: Get the online status of users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Online status info
 *       401:
 *         description: Unauthorized
 */
router.get('/online-status', [checkJwt, attachCurrentUser], getUserOnlineStatus);

/**
 * @swagger
 * /users/current-user:
 *   get:
 *     summary: Get current logged-in user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user object
 *       401:
 *         description: Unauthorized
 */
router.get('/current-user', [checkJwt, attachCurrentUser], getCurrentUser);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User object
 *       404:
 *         description: User not found
 */
router.get('/:id', [checkJwt], getUser);
module.exports = router;
