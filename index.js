const fse          = require("fs-extra");
const git          = require("nodegit");
const glob         = require("./vendor/promisified/glob");
const tmp          = require("./vendor/promisified/tmp");
const moment       = require("moment");
const semver       = require("semver");
const semverLatest = require("./lib/semver-latest");
const objMap       = require("./lib/obj-map");
const path         = require("path");
const mkdirp       = require("./vendor/promisified/mkdirp")


let config = require("./config.json");


let env = Object.assign({}, process.env);

// TODO: Check against the git repo also...
const localBranches = config.local.git.branches;
const localTags     = config.local.git.tags;

let repoInfo = {}
if(localBranches.indexOf(env.CIRCLE_BRANCH) > -1) {
  repoInfo.branch = env.CIRCLE_BRANCH;
}
else if(config.local.git.tags && env.CIRCLE_TAG) {
  repoInfo.tag    = env.CIRCLE_TAG;
}
else if(env.TRAVIS_BRANCH) {
  repoInfo.branch = env.TRAVIS_BRANCH;
}
else if(env.TRAVIS_TAG) {
  repoInfo.tag    = env.TRAVIS_TAG;
}
else {
  console.log("Not in CI env or branch or tag envs missing.");
  process.exit(0);
}

let outId;

if(semver.valid(repoInfo.tag)) {
  outId = semver.clean(repoInfo.tag);
}
// Check config branches here...
else if(repoInfo.branch === "master") {
  outId = repoInfo.branch;
}
else {
  console.log("No push required");
  process.exit(0);
}

config = objMap(config, function(key, val) {
  if(typeof(val) === "string") {
    return val.replace(/\${([^}]+)}/, function(a0, a1) {
      let parts = a1.split(":");
      let envKey = parts[0];
      let defaultVal = parts[1].replace(/^-/, "");

      if(process.env.hasOwnProperty(envKey)) {
        return process.env[envKey];
      }
      else {
        return defaultVal;
      }
    })
  }
  else {
    return val;
  }
});


console.log(JSON.stringify(config, null, 2));


function credentialsFn() {
  var max = 10;
  var count = 0;

  return function(url, userName) {
    console.log(url, userName);
    let out = git.Cred.sshKeyFromAgent(userName);

    count++
    if(max < count) {
      console.log("errored 10 times");
      process.exit(1);
    }

    return out;
  }
}



(async function() {
  try {
    const tmpFd = await tmp.dir({
      unsafeCleanup: true
    });

    const remoteUrl    = config.remote.git.url;
    const remoteBranch = config.remote.git.branch;

    console.log(tmpFd.path)

    const repo = await git.Clone(remoteUrl, tmpFd.path, {
      fetchOpts: {
        callbacks: {
          certificateCheck: function() {
            return 1;
          },
          credentials: credentialsFn()
        }
      }
    })
    const index = await repo.refreshIndex();

    let buildPath = path.join(__dirname, config.local.path);
    const basePath = path.join(repo.workdir(), "builds");


    console.log(buildPath)

    var files = await glob(buildPath+"/**/*");

    console.log(files);

    for(fileName of files) {
      console.log(fileName);
      var fileData = await fse.readFile(fileName);
      var relFileName = path.relative(buildPath, fileName);


      const repoFilePath = path.join(basePath, outId, relFileName);
      await mkdirp(path.dirname(repoFilePath));
      await fse.writeFile(repoFilePath, fileData);
      console.log("writing to %s", repoFilePath);
      await index.addByPath(
        path.relative(repo.workdir(), repoFilePath)
      );
    }

    const latestTag = semverLatest(await fse.readdir(basePath));
    const latestPath = path.join(basePath, "latest");
    const latestTagPath = path.join(basePath, latestTag);

    // Remove the old symlink. This might fail if it's the first time this
    // operation is run.
    try {
      await fse.unlink(latestPath);
    }
    catch (err) {
      // Ignore...
    }

    console.log("latestTag", latestTag);
    console.log("latestPath", latestPath);
    console.log("latestTagPath", latestTagPath);

    var relPath = path.relative(path.dirname(latestPath), latestTagPath)
    console.log("relPath", relPath);
    await fse.symlink(relPath, latestPath);


    await index.addByPath(path.relative(repo.workdir(), latestPath));
    await index.write();


    const oid = await index.writeTree();
    const head = await git.Reference.nameToId(repo, "HEAD");
    const parent = await repo.getCommit(head);


    var date = moment();

    var authorName  = config.remote.git.author.name;
    var authorEmail = config.remote.git.author.email;
    var timestamp = date.unix();
    var timestampOffset = date.utcOffset();

    console.log("timestamp", timestamp);
    console.log("timestampOffset", timestampOffset);
    console.log("authorName", authorName);
    console.log("authorEmail", authorEmail);

    var author = git.Signature.create(authorName, authorEmail, timestamp, timestampOffset);
    var committer = git.Signature.create(authorName, authorEmail, timestamp, timestampOffset);

    console.log("author", author);
    console.log("committer", committer);

    console.log("oid", oid);
    console.log("parent", parent)

    await repo.createCommit("HEAD", author, committer, "Written version '"+outId+"' to builds", oid, [parent]);


    const remote = await git.Remote.create(repo, "deploy-target", remoteUrl);

    console.log("remote", remote);
    console.log("remoteBranch", remoteBranch);


    await remote.push(["refs/heads/"+remoteBranch+":refs/heads/"+remoteBranch], {
      callbacks: {
        credentials: credentialsFn()
      }
    });

    tmpFd.cleanup();
  } catch(err) {
    console.log(err)
  }
})();
