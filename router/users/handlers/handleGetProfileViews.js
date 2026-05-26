const { ProfileView, User } = require('../../../models');

const VIEWER_ATTRIBUTES = [
  'id',
  'publicId',
  'username',
  'firstName',
  'lastName',
  'avatar',
];

const handleGetProfileViews = async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const { count, rows } = await ProfileView.findAndCountAll({
      where: { viewedUserId: userId },
      include: [
        {
          model: User,
          as: 'viewer',
          attributes: VIEWER_ATTRIBUTES,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.status(200).json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handleGetProfileViews;
