const router = require('express').Router();
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + './../config/database.js')[env];
const { sequelize } = require('../models');

console.log('config', config);
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
  