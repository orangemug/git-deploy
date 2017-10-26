const glob = require("glob");

module.exports = function(pattern, opts) {
  return new Promise(function(resolve, reject) {
    glob(pattern, opts, function(err, files) {
      if(err) {
        reject(err);
      }
      else {
        resolve(files);
      }
    })
  })
}
