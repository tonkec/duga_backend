const { User } = require('../models');
const canAccess = require('./../utils/canAccess');

const withAccessCheck = (model) => {
  return async (req, res, next) => {
    const resourceId = req.params.id; 
    
    const resource = await model.findByPk(resourceId);

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const user = await User.findOne({ where: { auth0Id: req.auth.sub } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const canAccessResource = canAccess(user, resource);
    if (!canAccessResource) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.resource = resource;
    next();
  };
};

module.exports = withAccessCheck;
