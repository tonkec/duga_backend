const canAccessFileKey = require('../utils/canAccessFileKey');

const authorizeFileAccess = async (req, res, next) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const key = decodeURIComponent(req.params[0]);
    const allowed = await canAccessFileKey(userId, key);

    if (!allowed) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authorizeFileAccess;
