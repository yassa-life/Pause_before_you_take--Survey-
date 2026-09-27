const requestHandler = require('../server.js');

module.exports = (req, res) => {
  req.url = '/api/admin/stats';
  return requestHandler(req, res);
};
