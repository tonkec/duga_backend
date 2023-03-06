require("dotenv").config();
module.exports = {
  appPort: process.env.APP_PORT,
  appKey: process.env.APP_KEY,
  appUrl: process.env.APP_URL,
};
