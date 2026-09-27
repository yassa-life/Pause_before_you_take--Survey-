const requestHandler = require('../server.js');

module.exports = (req, res) => {
  req.url = '/api/responses';
  return requestHandler(req, res);
};
