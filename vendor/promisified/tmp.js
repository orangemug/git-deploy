const tmp = require("tmp");

module.exports = {
  file: function(opts) {
    opts = opts || {};
    return new Promise(function(resolve, reject) {
      tmp.file(opts, function(err, path, fd, cleanup) {
        if(err) {
          reject(err);
        }
        else {
          resolve({
            path: path,
            fd: fd,
            cleanup: cleanup
          });
        }
      });
    })
  },
  dir: function(opts) {
    opts = opts || {};
    return new Promise(function(resolve, reject) {
      tmp.dir(opts, function(err, path, cleanup) {
        if(err) {
          reject(err);
        }
        else {
          resolve({
            path: path,
            cleanup: cleanup
          });
        }
      });
    })
  }
}
