const router = require('express').Router();
const { sequelize } = require('../models');
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check database connection health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database connected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Database connected
 *       500:
 *         description: Database connection error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Database connection error
 */
router.get('/', async (req, res) => {
    try {
        await sequelize.authenticate();
        return res.status(200).json({ message: 'Database connected' });
      } catch (error) {
        console.error('Database connection error:', error);
        return res.status(500).json({ message: 'Database connection error' });
      }
});

module.exports = router;
  