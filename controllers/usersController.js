const User = require("../models").User;
const sequelize = require("sequelize");
exports.update = async (res, req) => {
  if (req.file) {
    req.body.avatar = req.file.filename;
  }
  try {
    const [rows, result] = await User.update(req.body, {
      where: {
        id: req.user.id,
      },
      returning: true,
      individualHooks: true,
    });

    const user = result[0].get({ raw: true });
    user.avatar = result[0].avatar;
    delete user.password;

    return res.send(user);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

exports.search = async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        [sequelize.Op.or]: {
          namesConcated: sequelize.where(
            sequelize.fn(
              "concat",
              sequelize.col("firstName"),
              " ",
              sequelize.col("lastName")
            ),
            {
              [sequelize.Op.iLike]: `%${req.query.term}%`,
            }
          ),
          email: {
            [sequelize.Op.iLike]: `%${req.query.term}%`,
          },
        },
        [sequelize.Op.not]: {
          id: req.user.id,
        },
      },
      limit: 10,
    });

    return res.json(users);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
