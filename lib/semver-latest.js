const semver = require("semver");

module.exports = function(input) {
  const tags = input
    .filter(function(tag) {
      return semver.valid(tag);
    })
    .filter(function(tag) {
      // Ignore prerelease tags
      return !semver.prerelease(tag);
    })
    .sort(function(tagA, tagB) {
      if(semver.lt(tagA, tagB)) {
        return -1;
      }
      else if(semver.gt(tagA, tagB)) {
        return 1;
      }
      else {
        return 0;
      }
    });

  return tags[tags.length-1];
};
