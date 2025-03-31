'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
require('dotenv').config();
//const env = process.env.NODE_ENV || 'development';
const env ='development';
const config = require(__dirname + './../config/database.js')[env];
const db = {};
const { DB_USER, DB_PASSWORD, DB_HOST,DB_DATABASE } = process.env;

const sslOptions =
  env === 'development'
    ? {
      ssl: false,
    }
    : {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      };


const sequelize = new Sequelize({

        database: DB_DATABASE || config.database,
        username: DB_USER || config.username,
        password: DB_PASSWORD || config.password,
        host: DB_HOST || config.host,
        port: 5432,
        dialect: 'postgres',
        dialectOptions: sslOptions,


fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
