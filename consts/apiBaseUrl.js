const isProd = process.env.NODE_ENV === 'production'
const isStaging = process.env.NODE_ENV === "staging"

const API_BASE_URL =
  isProd || isStaging
    ? process.env.APP_URL
    : `${process.env.APP_URL}:${process.env.APP_PORT}`;
  
module.exports = {
  API_BASE_URL,
};