const User = require('../models').User;
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;
const MANAGEMENT_API_AUDIENCE = `https://${AUTH0_DOMAIN}/api/v2/`;
const axios = require('axios');

exports.register = async (req, res) => {
  const { email } = req.body;
  try {
    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create(req.body);

      res.status(201).json({ message: 'User created', user });
    } else {
      res.status(200).json({ message: 'User already exists', user });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

const getManagementApiToken = async () => {
  try {
    const response = await axios.post(`https://${AUTH0_DOMAIN}/oauth/token`, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: MANAGEMENT_API_AUDIENCE,
      grant_type: "client_credentials",
    });

    console.log("✅ Management API Token Retrieved:", response.data.access_token);
    return response.data.access_token;
  } catch (error) {
    console.error("❌ Error fetching Management API token:", error.response?.data || error.message);
    throw new Error("Failed to get Management API token");
  }
};
exports.sendVerificationEmail = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    const token = await getManagementApiToken();

    const response = await axios.post(
      `https://${AUTH0_DOMAIN}/api/v2/jobs/verification-email`,
      { user_id: userId },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    console.log("✅ Verification email sent:", response.data);
    res.json({ message: "Verification email sent successfully!", data: response.data });
  } catch (error) {
    console.error("❌ Error resending email:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
};