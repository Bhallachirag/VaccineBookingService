require('dotenv').config();

const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const sslOptions = (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com')) ? {
  ssl: {
    rejectUnauthorized: false
  }
} : undefined;

module.exports = {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME_DEVELOPMENT,
    host: process.env.DB_HOST,
    port: port,
    dialect: 'mysql',
    dialectOptions: sslOptions
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME_PRODUCTION || process.env.DB_NAME_DEVELOPMENT,
    host: process.env.DB_HOST,
    port: port,
    dialect: 'mysql',
    dialectOptions: sslOptions
  },
};
