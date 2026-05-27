const axios = require('axios');
const { User } = require('../../../models');
const { redactForLogs } = require('../../../utils/logRedaction');
const {
  buildRateLimitKeys,
  consumeAuthRateLimit,
} = require('../../../utils/authRateLimit');
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;
const MANAGEMENT_API_AUDIENCE = `https://${AUTH0_DOMAIN}/api/v2/`;
const VERIFICATION_EMAIL_THROTTLE_MS = Number(
  process.env.VERIFICATION_EMAIL_THROTTLE_MS ?? 60 * 1000
);

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

    const rateLimit = await consumeAuthRateLimit({
      action: 'verification_email',
      keys: buildRateLimitKeys(req, user.auth0Id),
      windowMs: VERIFICATION_EMAIL_THROTTLE_MS,
    });

    if (rateLimit.limited) {
      res.set?.('Retry-After', String(rateLimit.retryAfterSeconds));
      return res
        .status(429)
        .json({ error: 'Verification email recently sent' });
    }

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

    console.log('✅ Verification email sent:', redactForLogs(response.data));
    res.json({
      message: 'Verification email sent successfully!',
      data: response.data,
    });
  } catch (error) {
    console.error('❌ Error resending email:', redactForLogs(error));
    res.status(500).json({ error: 'Failed to send verification email' });
  }
};

module.exports = sendVerificationEmail;
