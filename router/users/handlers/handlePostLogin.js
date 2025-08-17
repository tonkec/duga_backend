const handlePostLogin = async (req, res) => {
  const sub = req?.auth?.sub;
  if (!sub) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { username, age, acceptPrivacy, acceptTerms } = req.body ?? {};

  if (!username || typeof username !== "string" || username.length < 3) {
    return res.status(400).json({ ok: false, error: "invalid_username" });
  }
  if (!Number.isInteger(age) || age < 18) {
    return res.status(400).json({ ok: false, error: "must_be_18_plus" });
  }
  if (acceptPrivacy !== true) {
    return res.status(400).json({ ok: false, error: "privacy_required" });
  }
  if (acceptTerms !== true) {
    return res.status(400).json({ ok: false, error: "terms_required" });
  }

  try {
    // find user by Auth0 sub
    const user = await User.findOne({ where: { auth0_user_id: sub } });
    if (!user) {
      return res.status(404).json({ ok: false, error: "user_not_found" });
    }

    // update properties
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
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};

module.exports = handlePostLogin;
