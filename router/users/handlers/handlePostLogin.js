const User = require('../../../models').User;

const handlePostLogin = async (req, res) => {
    const sub = req?.auth?.sub;
    console.log(req.auth)
  if (!sub) {
    return res.status(401).json({ ok: false, errors: ["unauthorized"] });
  }

  const { username, age, acceptPrivacy, acceptTerms } = req.body ?? {};

   if (!username || typeof username !== "string" || username.length < 3) {
    return res.status(400).json({ ok: false, errors: ["invalid_username"] });
    }

  // check uniqueness
  const existing = await User.findOne({ where: { username } });
      if (existing && existing.auth0_user_id !== sub) {
      return res.status(400).json({ ok: false, errors: ["username_taken"] });
    }

  if (!Number.isInteger(age) || age < 18) {
    return res.status(400).json({ ok: false, errors: ["must_be_18_plus"] });
  }
  if (acceptPrivacy !== true) {
    return res.status(400).json({ ok: false, errors: ["privacy_required"] });
  }
  if (acceptTerms !== true) {
    return res.status(400).json({ ok: false, errors: ["terms_required"] });
  }

  try {
    const user = await User.findOne({ where: { auth0_user_id: sub } });
    if (!user) {
      return res.status(404).json({ ok: false, errors: ["user_not_found"] });
    }

    user.username = username;
    user.age = age;
    user.accept_privacy = acceptPrivacy;
    user.accept_terms = acceptTerms;
    user.onboarding_done = true;

    await user.save();

    return res.json({
      ok: true,
      user: {
        id: user.id,
        auth0_user_id: user.auth0_user_id,
        username: user.username,
        age: user.age,
        acceptPrivacy: user.accept_privacy,
        acceptTerms: user.accept_terms,
        onboarding_done: user.onboarding_done,
        first_login_at: user.first_login_at,
      },
    });
  } catch (e) {
      console.error("Error in handlePostLogin:", e);
    return res.status(500).json({ ok: false, errors: ["server_error"] });
  }
};

module.exports = handlePostLogin;
