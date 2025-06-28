const canAccess = require("./../utils/canAccess");

const withAccessCheck = (model) => {
  return async (req, res, next) => {
    const resource = await model.findByPk(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    if (!canAccess(req.auth, resource)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.resource = resource;
    next();
  };
};

module.exports = withAccessCheck;