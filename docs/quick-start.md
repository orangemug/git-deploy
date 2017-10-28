# Quick start
This guide will show you how to setup `git-deploy` for building a project


## Generate ssh key pairs
First off you'll need to generate some ssh key pairs to use as a deploy key for your target repo.

To do that run the following

```
ssh-keygen -t rsa -b 4096 -C "your_email@example.com" -f deploy_key
```

**Note:** More info can be found <https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/>

The `-f` in the path to output the deploy key.


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
 - `remote.git.path` - the subpath in the above git repo where the built files should go


## GitHub
Copy your public key into the target repositories deploy keys. This will be the `deploy-key.pub` in the current directory.

Go to the url `https://github.com/USER/REPO/settings/keys` where `USER/REPO` points to your target repo for you builds.

Add the public key while making sure to

 - allow write access
 - name it something sensible like `git-deploy`


## CI service
You'll also need to add your keys to the CI service. Supported is

 - CircleCI
 - Travis (in theory)


### CircleCI
First off you'll need to create a config in your host repository. This will differ depending on your test setup on circleci, however an example can be found here <https://github.com/orangemug/git-deploy-demo/blob/master/.circleci/config.yml>

Now head over the the circleci and enable builds for this repository. While you're there also add the private key of the ssh pair. You can do this at `https://circleci.com/gh/USER/REPO/edit#ssh`, where user repo are the `USER/REPO` of the repository you want to deploy to.

Also note, the hostname should be set to `github.com`


### Travis
TODO


### Summary
Now when you push to a configured branch or create a tag with the semver format they should be deployed to your repository.
