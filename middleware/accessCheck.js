const { User } = require('../models');
const canAccess = require('./../utils/canAccess');

const withAccessCheck = (model, lookupFn = null) => {
  return async (req, res, next) => {
    try {
      const auth0Id = req.auth?.sub;
      if (!auth0Id) {
        return res.status(401).json({ message: 'Missing auth0Id in token' });
      }

      const user = req.currentUser || (await User.findOne({ where: { auth0Id } }));
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      let resource;
      if (lookupFn) {
        resource = await lookupFn(req);
      } else {
        const resourceId = req.params.id;
        if (!resourceId) {
          return res.status(400).json({ error: 'Missing resource ID' });
        }
        resource = await model.findByPk(resourceId);
      }

      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      const hasAccess = await canAccess(user, resource);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.resource = resource;
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
};


module.exports = withAccessCheck;
