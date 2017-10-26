const mkdirp = require("mkdirp");

module.exports = function(dir, opts) {
  return new Promise(function(resolve, reject) {
    mkdirp(dir, opts, function(err) {
      if(err) {
        reject(err);
      }
      else {
        resolve();
      }
    })
  })
}
