require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    dialect: 'postgres',
  },
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    dialect: 'postgres',
  },
  production: {
    use_env_variable: 'DATABASE_URL', // Use DATABASE_URL from the environment
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true, // Ensure SSL is used
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    },
  },
};
