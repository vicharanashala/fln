const Logbook = require('../models/Logbook');

const logAction = (action) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = async function(body) {
      try {
        await Logbook.create({
          action,
          performedBy: req.user?._id,
          performedByRole: req.user?.role,
          school: req.body?.school || req.params?.schoolId || req.query?.schoolId,
          class: req.body?.classId || req.params?.classId,
          student: req.body?.studentId || req.params?.studentId,
          description: `${action} performed by ${req.user?.email}`,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode
          },
          ipAddress: req.ip
        });
      } catch (err) {
        console.error('Logging failed:', err.message);
      }
      return originalJson.call(this, body);
    };
    next();
  };
};

module.exports = { logAction };
