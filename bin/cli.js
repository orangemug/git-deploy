const yargs = require("yargs");
const objMap       = require("../lib/obj-map");
const fse   = require("fs-extra");
const gitDeploy = require("../");


async function parseConfig(filepath) {
  let config;
  let data;

  try {
    data = await fse.readFile(filepath);
  } catch(err) {
    console.error("Error: loading file: '%s'", filepath, err);
    process.exit(40);
  }

  try {
    config = JSON.parse(data);
  } catch(err) {
    console.error("Error: invalid JSON '%s'", filepath, err);
    process.exit(41);
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

  return config;
}

const argv = yargs
  .usage('Usage: $0 <command> <config>')
  .command('check', 'check whether release required on current branch', (yargs) => {
    yargs
      .demand(1)
  }, async function(argv) {
    const filepath = argv._[1];
    const config = await parseConfig(filepath);
    try {
      const isRequired = await gitDeploy.check(config);
    } catch(err) {
      console.log("Error:", err);
      process.exit(3);
    }

    if(isRequired) {
      process.exit(0);
    }
    else {
      process.exit(1);
    }

    // All ok.
    process.exit(0);
  })
  .command('push', 'push release to git repo if required', (yargs) => {
  }, async function(argv) {
    const filepath = argv._[1];
    const config = await parseConfig(filepath);

    try {
      await gitDeploy.push(config);
    } catch(err) {
      console.log("Error:", err);
      process.exit(3);
    }

    // All ok.
    process.exit(0);
  })
  .version()
  .alias("version", "v")
  .help("h")
  .alias("help", "h")
  .argv

// No commands just show the help
if(argv._.length < 1) {
  yargs.showHelp();
}

