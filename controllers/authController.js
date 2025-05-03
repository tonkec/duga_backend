const axios = require('axios');
const { sequelize, User, PhotoComment, Upload, PhotoLikes, Message, Notification } = require('../models');
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;
const MANAGEMENT_API_AUDIENCE = `https://${AUTH0_DOMAIN}/api/v2/`;

exports.register = async (req, res) => {
  const { email } = req.body;
  try {
    const [user, created] = await User.findOrCreate({
      where: { email },
      defaults: req.body,
    });

    if (created) {
      res.status(201).json({ message: 'User created', user });
    } else {
      res.status(200).json({ message: 'User already exists', user });
    }
  } catch (error) {
    console.error('Error registering user:', error);
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

const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
});
const s3 = new AWS.S3();

const deleteAllUserImagesFromS3 = async (userId) => {
  const Bucket = 'duga-user-photo';
  const Prefix = `user/${userId}/`;

  try {
    const list = await s3
      .listObjectsV2({ Bucket, Prefix })
      .promise();

    if (!list.Contents.length) return;

    const objects = list.Contents.map((obj) => ({ Key: obj.Key }));

    await s3
      .deleteObjects({
        Bucket,
        Delete: { Objects: objects },
      })
      .promise();

    console.log(`🧹 Deleted ${objects.length} S3 objects for user ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to delete user ${userId}'s S3 images:`, error);
    throw error;
  }
};

exports.deleteUser = async (req, res) => {
  const userId = parseInt(req.query.userId);
  const auth0UserId = req.query.auth0UserId

  if (!auth0UserId) {
    return res.status(400).json({ error: 'Missing Auth0 user ID' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'Missing user ID' });
  }

  const t = await sequelize.transaction();
  try {
    await Notification.destroy({ where: { userId }, transaction: t });
    await PhotoComment.destroy({ where: { userId }, transaction: t });
    await PhotoLikes.destroy({ where: { userId }, transaction: t });
    await Upload.destroy({ where: { userId }, transaction: t });
    await Message.destroy({ where: { fromUserId: userId }, transaction: t });
    await deleteAllUserImagesFromS3(userId);

    await sequelize.query(
      `DELETE FROM "ChatUsers" WHERE "userId" = :userId`,
      { replacements: { userId }, transaction: t }
    );

    await sequelize.query(
      `DELETE FROM "Chats"
       WHERE id IN (
         SELECT c.id FROM "Chats" c
         LEFT JOIN "ChatUsers" cu ON cu."chatId" = c.id
         GROUP BY c.id
         HAVING COUNT(cu."userId") = 0
       )`,
      { transaction: t }
    );

    await User.destroy({ where: { id: userId }, transaction: t });
    await t.commit();

    const token = await getManagementApiToken();

    await axios.delete(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(auth0UserId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(`✅ Deleted user ${userId} and Auth0 user ${auth0UserId}`);
    res.status(200).json({ message: 'User and Auth0 account deleted.' });
  } catch (err) {
    await t.rollback();
    console.error('❌ Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

