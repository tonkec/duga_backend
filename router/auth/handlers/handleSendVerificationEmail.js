const axios = require('axios');
const { User } = require('../../../models');
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;

const sendVerificationEmail = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    const user = await User.findByPk(userId);

    if (!user || !user.auth0Id) {
      return res.status(404).json({ error: "User not found or missing auth0Id" });
    }

    const token = await getManagementApiToken();

    const response = await axios.post(
      `https://${AUTH0_DOMAIN}/api/v2/jobs/verification-email`,
      { user_id: user.auth0Id }, 
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Verification email sent:", response.data);
    res.json({ message: "Verification email sent successfully!", data: response.data });
  } catch (error) {
    console.error("❌ Error resending email:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
};

module.exports = sendVerificationEmail