const Ajv          = require('ajv');
const debug        = require('debug')('git-deploy');
const fse          = require("fs-extra");
const git          = require("nodegit");
const glob         = require("./vendor/promisified/glob");
const mkdirp       = require("./vendor/promisified/mkdirp")
const moment       = require("moment");
const path         = require("path");
const semver       = require("semver");
const semverLatest = require("./lib/semver-latest");
const tmp          = require("./vendor/promisified/tmp");


const schema = require("./schemas/config.json");
const ajv = new Ajv();
const validate = ajv.compile(schema);


async function check(config) {
  let env = Object.assign({}, process.env);

  var valid = validate(config);
  if (!valid) {
    throw "Config "+ajv.errorsText(validate.errors)+" see schema <https://github.com/orangemug/git-deploy/blob/master/schemas/config.json>";
  }

  // TODO: Check against the git repo also...
  const localBranches = config.local.git.branches;
  const localTags     = config.local.git.tags;

  let repoInfo = {}
  if(config.local.git.tags && env.CIRCLE_TAG) {
    repoInfo.tag    = env.CIRCLE_TAG;
  }
  else if(localBranches.indexOf(env.CIRCLE_BRANCH) > -1) {
    repoInfo.branch = env.CIRCLE_BRANCH;
  }
  else if(env.TRAVIS_TAG) {
    repoInfo.tag    = env.TRAVIS_TAG;
  }
  else if(env.TRAVIS_BRANCH) {
    repoInfo.branch = env.TRAVIS_BRANCH;
  }
  else {
    debug("Not in CI env or branch or tag envs missing.");
    return false;
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
    debug("No push required");
    return false;
  }

  // TODO: Yeah this is a hack...
  return outId;
}


async function push(config) {
  const outId = await check(config);
  if(!outId) {
    return false;
  }

  function credentialsFn() {
    var max = 10;
    var count = 0;

    return function(url, userName) {
      let out = git.Cred.sshKeyFromAgent(userName);

      count++
      if(max < count) {
        throw "Can't authenticate git endpoint";
      }

      return out;
    }
  }

  let tmpFd;

  try {
    tmpFd = await tmp.dir({
      unsafeCleanup: true
    });

    const remoteUrl    = config.remote.git.url;
    const remoteBranch = config.remote.git.branch;

    debug("Writing to directory '"+tmpFd.path+"'");

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

    let buildPath;
    if(config.local.path.match(/^[~/]/)) {
      buildPath = config.local.path;
    } else {
      buildPath = path.join(process.cwd(), config.local.path);
    }
    const basePath = path.join(repo.workdir(), "builds");

    debug("build path: "+buildPath);
    var files = await glob(buildPath+"/**/*");


    for(fileName of files) {
      const stats = await fse.lstat(fileName);
      if(stats.isDirectory()) {
        debug("Skipping directory ", fileName);
        continue;
      }

      debug("Writing file to directory: '"+fileName+"'");
      var fileData = await fse.readFile(fileName);
      var relFileName = path.relative(buildPath, fileName);


      const repoFilePath = path.join(basePath, outId, relFileName);
      await mkdirp(path.dirname(repoFilePath));
      await fse.writeFile(repoFilePath, fileData);
      debug("Writing file to index: '"+fileName+"'");
      await index.addByPath(
        path.relative(repo.workdir(), repoFilePath)
      );
    }

    // This protects against adding an additional commit if no files have changed.
    // This may happen if you try to generate the same build twice.
    const statuses = await repo.getStatus();
    if(statuses.length < 1) {
      debug("Nothing to write");
      return false;
    }

    dirfiles = await fse.readdir(basePath);
    const latestTag = semverLatest(dirfiles);

    debug("latest tag", latestTag)
    if(latestTag) {
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

      var relPath = path.relative(path.dirname(latestPath), latestTagPath)
      await fse.symlink(relPath, latestPath);


      await index.addByPath(path.relative(repo.workdir(), latestPath));
    }

    await index.write();


    const oid = await index.writeTree();
    const head = await git.Reference.nameToId(repo, "HEAD");
    const parent = await repo.getCommit(head);


    var date = moment();

    var authorName  = config.remote.git.author.name;
    var authorEmail = config.remote.git.author.email;
    var timestamp = date.unix();
    var timestampOffset = date.utcOffset();

    var author = git.Signature.create(authorName, authorEmail, timestamp, timestampOffset);
    var committer = git.Signature.create(authorName, authorEmail, timestamp, timestampOffset);

    await repo.createCommit("HEAD", author, committer, "Written version '"+outId+"' to builds", oid, [parent]);


    const remote = await git.Remote.create(repo, "deploy-target", remoteUrl);

    await remote.push(["refs/heads/"+remoteBranch+":refs/heads/"+remoteBranch], {
      callbacks: {
        credentials: credentialsFn()
      }
    });

  } catch(err) {
    // Always clean up before propagating the error
    tmpFd.cleanup();
    throw err;
  }
  tmpFd.cleanup();
}

module.exports = {
  push: push,
  check: check
};

