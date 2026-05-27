const axios = require('axios');
const { User } = require('../../../models');
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;
const MANAGEMENT_API_AUDIENCE = `https://${AUTH0_DOMAIN}/api/v2/`;
const VERIFICATION_EMAIL_THROTTLE_MS = Number(
  process.env.VERIFICATION_EMAIL_THROTTLE_MS ?? 60 * 1000
);
const verificationEmailAttempts = new Map();

const getManagementApiToken = async () => {
  const response = await axios.post(`https://${AUTH0_DOMAIN}/oauth/token`, {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    audience: MANAGEMENT_API_AUDIENCE,
    grant_type: 'client_credentials',
  });

  return response.data.access_token;
};

const sendVerificationEmail = async (req, res) => {
  try {
    const auth0Id = req.auth?.sub;

    if (!auth0Id) {
      return res.status(401).json({ error: 'Missing Auth0 identity claims' });
    }

    const user = await User.findOne({ where: { auth0Id } });

    if (!user || !user.auth0Id) {
      return res
        .status(404)
        .json({ error: 'User not found or missing auth0Id' });
    }

    const now = Date.now();
    const lastAttemptAt = verificationEmailAttempts.get(auth0Id);

    if (lastAttemptAt && now - lastAttemptAt < VERIFICATION_EMAIL_THROTTLE_MS) {
      return res
        .status(429)
        .json({ error: 'Verification email recently sent' });
    }

    verificationEmailAttempts.set(auth0Id, now);

    const token = await getManagementApiToken();

    const response = await axios.post(
      `https://${AUTH0_DOMAIN}/api/v2/jobs/verification-email`,
      { user_id: user.auth0Id },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Verification email sent:', response.data);
    res.json({
      message: 'Verification email sent successfully!',
      data: response.data,
    });
  } catch (error) {
    console.error(
      '❌ Error resending email:',
      error.response?.data || error.message
    );
    res.status(500).json({ error: error.response?.data || error.message });
  }
};

module.exports = sendVerificationEmail;
