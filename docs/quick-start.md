# Quick start
This guide will show you how to setup `git-deploy` and all the associated services for deploying builds.


## Generate ssh key pairs
First off you'll need to generate some ssh key pairs to use as a deploy key for your target repo.

To do that run the following, replacing the example email address with your own.

```
ssh-keygen -t rsa -b 4096 -C "your_email@example.com" -f deploy_key
```

**Note:** More info can be found <https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/>

The `-f` is the path to output the deploy key. This will output the keys to the local directory.


## git-deploy config
Create a `.git-deploy/config.json` file in the root of your source repository. Add the following

```json
{
  "local": {
    "path": "./build",
    "git": {
      "tags": true,
      "branches": [
        "master"
      ]
    }
  },
  "remote": {
    "git": {
      "url": "git@github.com:USER/DEPLOY-REPO.git",
      "path": "builds",
      "branch": "master",
      "author": {
        "name": "Build bot",
        "email": "noreply@example.com"
      }
    }
  }
}
```

The setting should be fairly obvious but the important ones to change are

 - `local.path` - the place with the build files
 - `remote.git.url` - the git url of the build repository
 - `remote.git.path` - the subpath in the above git repository where the built files should go


## GitHub
Add your public key into the target repositories deploy keys. This will be the `deploy-key.pub` in the current directory.

Go to the url `https://github.com/USER/REPO/settings/keys` where `USER/REPO` points to the target repository for your builds.

Add the public key while making sure to

 - allow write access (the checkbox in the UI)
 - name it something sensible like `git-deploy`


## CI service
You'll also need to add your private key to the CI service. Currently we support

 - [CircleCI](https://circleci.com/)
 - [Travis CI](https://travis-ci.org/)


### CircleCI
First off you'll need to create a config in your host repository. This will differ depending on your test setup on CircleCI, however an example can be found here <https://github.com/orangemug/git-deploy-demo/blob/master/.circleci/config.yml>

Now head over the CircleCI and enable builds for the source repository. While you're there also add the private key of the ssh key pair. You can do this at `https://circleci.com/gh/USER/REPO/edit#ssh`, where user repository are the `USER/REPO` of the repository you want to deploy to. The hostname should be set to `github.com`


### Travis CI
TODO: Travis is still a work in progress


### Summary
Now when you push to a configured branch or create a tag with the semver format they will be deployed to your target repository.
