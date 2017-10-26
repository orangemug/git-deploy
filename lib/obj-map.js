function objMap(obj, fn, path) {
	var outObj = {};

  for(var k in obj) {
    var keyPath;
    if(!obj.hasOwnProperty(k)) continue;

    if(path) {
      keyPath = path.concat(k);
    } else {
      keyPath = [k];
    }

    if(
         typeof(obj[k]) === "object"
      && !(obj[k] instanceof Array)
    ) {
      outObj[k] = objMap(obj[k], fn, keyPath);
    } else {
      outObj[k] = fn(keyPath, obj[k]);
    }
  }
  return outObj;
}

module.exports = objMap;
