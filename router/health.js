const router = require('express').Router();
const { sequelize } = require('../models');
router.get('/', async (req, res) => {
    console.log('DATABASE_URL:', process.env.DATABASE_URL);

    try {
        await sequelize.authenticate();
        return res.status(200).json({ message: 'Database connected' });
      } catch (error) {
        console.error('Database connection error:', error);
        return res.status(500).json({ message: 'Database connection error' });
      }
});

module.exports = router;
  