const reporter = require('cucumber-html-reporter');

const options = {
  theme: 'bootstrap',
  jsonFile: './reports/cucumber.json',
  output: './reports/cucumber_report.html',
  reportSuiteAsScenarios: true,
  launchReport: true, // Set to true if you want the report to open automatically after generation.
  ignoreBadJsonFile: true,
  metadata: {
    "App Version": "1.0.0",
    "Test Environment": "QA",
    "Browser": "Chrome",
    "Platform": "Mac OS",
    "Parallel": "Scenarios",
    "Executed": "Local"
  }
};

reporter.generate(options);