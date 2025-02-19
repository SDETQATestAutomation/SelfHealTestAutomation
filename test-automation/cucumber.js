
var mkdirp = require('mkdirp');
const made_dir_reports = mkdirp.sync('reports');
console.log(`made reports directories, starting with ${made_dir_reports}`);
const made_dir_logs = mkdirp.sync('logs');
console.log(`made log directories, starting with ${made_dir_logs}`);
module.exports = {
  default: [
    '--format progress-bar',
    '--format @cucumber/pretty-formatter',
    '--format rerun:@rerun.txt',
    '--format usage:reports/usage.txt',
    '--format message:reports/messages.ndjson',
    '--format json:reports/cucumber.json',
    '--require node_modules/nightwatch/cucumber-js/_setup_cucumber_runner.js',
    '--require tests/stepdefs/hooks.js',
    '--require tests/stepdefs',
  ].join(' ')
};
