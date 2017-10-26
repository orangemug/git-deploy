# git-deploy
Pushes builds into a git repository.

[![stability-unstable](https://img.shields.io/badge/stability-unstable-yellow.svg)][stability]
[![Build Status](https://circleci.com/gh/orangemug/git-deploy.png?style=shield)][circleci]
[![Dependency Status](https://david-dm.org/orangemug/git-deploy.svg)][dm-prod]
[![Dev Dependency Status](https://david-dm.org/orangemug/git-deploy/dev-status.svg)][dm-dev]

[stability]:   https://github.com/orangemug/stability-badges#unstable
[circleci]:    https://circleci.com/gh/orangemug/git-deploy
[dm-prod]:     https://david-dm.org/orangemug/git-deploy
[dm-dev]:      https://david-dm.org/orangemug/git-deploy#info=devDependencies

Git is a great place to store builds for open source projects. The permissions are already set up for your team, it's usually free and it lives alongside the rest of your code.

This is designed for a CI environment to push build artifacts after the tests pass. But can also be used locally if required.

Note: This was originally designed for the [maputnik/editor](https://github.com/maputnik/editor) build process, but should be generally useful for other projects also.


## Install
To install run

```
npm install orangemug/git-deploy
```

## Usage
Git deploy looks at CI enviroment variables to determine the branch / tag thats just been tested. If the _tag_ matches a semver or the _branch_ is one of the configured branches to deploy. It'll deploy files from a specified directory.

Ok that was a little confusing lets see an example. We've just pushed a build to git first off you're CI enviroment **must** write the build files to a directory. Below we've stored our builds in `/tmp/build`

```
/tmp
└──build/
   ├── 188a0a72037ff8b19c72.vendor.js
   ├── app.8aa28fc5c91f468dd8b6.js
   ├── favicon.ico
   ├── fonts
   │   ├── Roboto-Medium.ttf
   │   └── Roboto-Regular.ttf
   ├── img
   │   └── maputnik.png
   └── index.html
```

Next up we need to create a config to let `git-deploy` what needs to be deployed and where. Below is an example `config.json` with documentation inline

```js
{
  // Settings for the local files.
  "local": {
    // Path of the files locally
    "path": "/tmp/build",
    // What to deploy from the git repo.
    "git": {
      // Any tags that match semver should be deployed
      "tags": true,
      // Any branches that match `master` should be deployed
      "branches": [
        "master"
      ]
    }
  },
  "remote": {
    "git": {
      // The git repository to deploy to
      "url": "git@github.com:orangemug/git-build-push-demo.git",
      // The path in the repository the files should be deployed to
      "path": "builds",
      // The branch the files should live in
      "branch": "master",
      // The author of the release commit
      "author": {
        "name": "Build bot",
        "email": "noreply@example.com"
      }
    }
  }
}
```

Now when we run `git-deploy config.json` if we are building a tag (semver) or branch (defined in the config). It'll deploy the files to the git repo as defined in the config.

The tag and branch will be defined from the enviroment variables of the CI enviroment. Currently travis and circleci are supported, using the following env variables.

 - `CIRCLE_BRANCH`
 - `CIRCLE_TAG`
 - `TRAVIS_BRANCH`
 - `TRAVIS_TAG`

The resulting directory struture in the target repository will look something like this

```
builds
├── 0.1.0
├── 0.1.1
├── 0.2.0
├── 0.3.0-beta
└── latest -> ./0.2.0
```

You'll notice it's also added a `latest` symlink pointing towards the latest _non prerelease_ build.


## Config
A json schema for the config can be found at [./schemas/config.json](./schemas/config.json)

Also note that the config supports bash style variables with defaults. For example the following will use the `ARTIFACTS_DIR` env variable if defined otherwise default to `public`.

```json
{
  "local": {
    "path": "${ARTIFACTS_DIR:-public}"
  }
}
```


## Generate old builds
To generate builds for old tags branches use another tool called [git-cmd](https://github.com/orangemug/git-cmd) which will checkout your code and run a command for all branches / tags.

```
git-cmd --branches --tags "git-deploy check; npm build; git-deploy push"
```

We first run `git-deploy check` to see if it's a candiate for deploy. Then we run the the build process and push the resulting files.

**Note:** This will need some tweeking if your build command or build file location has changed throughout time.


## Notes
You can't have a passphrase on your git ssh keys, more details for OSX here <https://stackoverflow.com/questions/7773181/git-keeps-prompting-me-for-password>


## License
[MIT](LICENSE)
