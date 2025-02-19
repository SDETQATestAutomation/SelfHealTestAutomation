const Nightwatch = require('nightwatch');
var globalJS = require('./globals/globals.js');

// this.parameters.settings.globals.waitForConditionTimeout = 10000;

try {
  Nightwatch.cli(async function(argv) {
    argv._source = argv['_'].slice(0);
    var settings = {
      globals: {
        environment: argv.environment,
        browser: argv.browser,
        env: argv.env
      }
    };
    argv.env = argv.e = settings.globals.browser;
    globalJS.environment = argv.environment;
    console.dir(argv);
    const runner = Nightwatch.CliRunner(argv);
    await runner.setup(settings);
    await runner.runTests();
  });

} catch (error) {
  Utils.showStackTrace(
    'There was an error while starting the test runner:\n',
    error.stack + '\n',
    true
  );
  process.exit(2);
}

