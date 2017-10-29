const assert       = require("assert");
const dirtreeAsObj = require("dirtree-as-obj");
const fse          = require("fs-extra");
const git          = require("nodegit");
const gitDeploy    = require("../");
const glob         = require("../vendor/promisified/glob");
const moment       = require("moment");
const path         = require("path");
const tmp          = require("../vendor/promisified/tmp");


async function commitLog(repo, branch) {
  const firstCommitOnMaster = await repo.getMasterCommit();
  const history = firstCommitOnMaster.history(git.Revwalk.SORT.Time);

  return new Promise(function(resolve, reject) {
    const log = [];

    history.on("commit", function(commit) {
      log.push({
        sha: commit.sha(),
        author: {
          name: commit.author().name(),
          email: commit.author().email()
        },
        date: commit.date(),
        message: commit.message()
      });
    })

    history.on("error", function(err) {
      reject(err);
    });

    history.on("end", function(err) {
      resolve(log);
    });

    history.start();
  })
}

async function readDir(dirpath) {
  const files = await glob(dirpath+"/**/*");
  let filesWithContents = {};
  for(file of files) {
    const data = await fse.readFile(file)
    const relpath = path.relative(dirpath, file);
    filesWithContents[relpath] = data.toString();
  }

  return dirtreeAsObj(filesWithContents);
}

async function addCommit(repo, files, author, message) {
  const index = await repo.refreshIndex();

  // Commit a file
  for([filename, filecontent] of files) {
    await fse.writeFile(repo.workdir()+"/"+filename, filecontent);
  }
  await index.addByPath("test_file");
  await index.write();
  const oid = await index.writeTree();

  var date = moment();
  var timestamp = date.unix();
  var timestampOffset = date.utcOffset();

  const authorSig = git.Signature.create(author.name, author.email, timestamp, timestampOffset);
  const committerSig = git.Signature.create(author.name, author.email, timestamp, timestampOffset);

  let parent;
  try {
    const head  = await git.Reference.nameToId(repo, "HEAD");
    parent = await repo.getCommit(head);
  } catch(err) {
    // HACK: Ignore...
  }
  
  if(parent) {
    await repo.createCommit("HEAD", authorSig, committerSig, message, oid, [parent]);
  }
  else {
    await repo.createCommit("HEAD", authorSig, committerSig, message, oid, []);
  }
}


async function test(sourceRepoPath, destRepoPath) {
  // Author of the commits
  const author = {
    name: "test",
    email: "test@example.com"
  };

  const gitDeployOpts = {
    experimentalBranchMode: true
  };

  // Setup: Create repo
  const repo = await git.Repository.init(sourceRepoPath, 0);
  const destRepo = await git.Repository.init(destRepoPath, 1);

  const config = {
    "local": {
      "path": repo.workdir(),
      "git": {
        "tags": true,
        "branches": [
          "master"
        ]
      }
    },
    "remote": {
      "git": {
        "url": "file://"+destRepoPath,
        "path": "builds",
        "branch": "master",
        "author": {
          "name": "Bot",
          "email": "noreply@maputnik.com"
        }
      }
    }
  }


  // 1. Initial setup
  {
    const files = [
      ["test_file", "step 1"]
    ];
    await addCommit(repo, files, author, "step 1");

    const log = await commitLog(repo, "master");
    assert.equal(log.length, 1);

    const fileTree = await readDir(repo.workdir());
    assert.deepEqual(fileTree, {
      "test_file": "step 1"
    })
  }

  // 2. Master deploy
  {
    const files = [
      ["test_file", "step 2"]
    ];
    await addCommit(repo, files, author, "step 2");
    const log = await commitLog(repo, "master");

    const fileTree = await readDir(repo.workdir());
    assert.deepEqual(fileTree, {
      "test_file": "step 2"
    })

    process.env["CIRCLE_BRANCH"] = "master";
    await gitDeploy.push(config, gitDeployOpts);

    const destLog = await commitLog(destRepo, "master");
    assert.equal(destLog.length, 1);
    assert.equal(destLog[0].message, "Written version 'master' to builds");
    assert.deepEqual(destLog[0].author, config.remote.git.author);
  }

  // 3. Tag deploy
  {
    const files = [
      ["test_file", "step 3"]
    ];
    await addCommit(repo, files, author, "step 3");
    const log = await commitLog(repo, "master");

    const fileTree = await readDir(repo.workdir());
    assert.deepEqual(fileTree, {
      "test_file": "step 3"
    })

    process.env["CIRCLE_TAG"] = "0.1.0";
    delete process.env["CIRCLE_BRANCH"];
    await gitDeploy.push(config, gitDeployOpts);

    const destLog = await commitLog(destRepo, "master");
    assert.equal(destLog.length, 2);
    assert.equal(destLog[0].message, "Written version '0.1.0' to builds");
    assert.deepEqual(destLog[0].author, config.remote.git.author);
  }

  // 4. No-op deploy
  {
    delete process.env["CIRCLE_TAG"];
    delete process.env["CIRCLE_BRANCH"];
    await gitDeploy.push(config, gitDeployOpts);

    const destLog = await commitLog(destRepo, "master");
    assert.equal(destLog.length, 2);
    assert.equal(destLog[0].message, "Written version '0.1.0' to builds");
    assert.deepEqual(destLog[0].author, config.remote.git.author);
  }

  // 5. Master deploy
  {
    const files = [
      ["test_file", "step 4"]
    ];
    await addCommit(repo, files, author, "step 4");
    const log = await commitLog(repo, "master");

    const fileTree = await readDir(repo.workdir());
    assert.deepEqual(fileTree, {
      "test_file": "step 4"
    })

    delete process.env["CIRCLE_TAG"];
    process.env["CIRCLE_BRANCH"] = "master";
    await gitDeploy.push(config, gitDeployOpts);

    const destLog = await commitLog(destRepo, "master");
    assert.equal(destLog.length, 3);
    assert.equal(destLog[0].message, "Written version 'master' to builds");
    assert.deepEqual(destLog[0].author, config.remote.git.author);
  }

}

async function setup() {
  const sourceRepoPath = await tmp.dir({unsafeCleanup: true});
  const destRepoPath   = await tmp.dir({unsafeCleanup: true});

  try {
    test(sourceRepoPath.path, destRepoPath.path);
  } catch(err) {
    sourceRepoPath.cleanup();
    destRepoPath.cleanup();
    throw err;
  }
}

setup();

