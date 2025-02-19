const { BeforeAll, AfterAll, After, Status } = require('@cucumber/cucumber');
const fs = require('fs');
const path = require('path');

const failedScenariosPath = path.join(__dirname, '..', 'failed_scenarios.txt');

BeforeAll(() => {
  // Remove any leftover file from previous runs
  if (fs.existsSync(failedScenariosPath)) {
    fs.unlinkSync(failedScenariosPath);
  }
});

AfterAll(() => {
  // Post-run cleanup or reporting can go here
});

After(async function () {
    try {
        await browser.closeWindow();
      } catch (error) {
        console.log(error)
      }
      try {
        await browser.end();
      } catch (error) {
        console.log(error)
      }
      try {
        await browser.quit()
      } catch (error) {
        console.log(error)
      }
    console.info('*--*--*--*--*--*--*--*--*--*--*--*--*');
    console.info('*--Test case execution completed, Closing session... Good bye! --*');
    console.info('*--*--*--*--*--*--*--*--*--*--*--*--*');
  
  });

After(function(scenario) {
  if (scenario.result.status === Status.FAILED) {
    // scenario.pickle.uri -> "features/login.feature"
    // scenario.pickle.locations -> array of { line, column }
    // Typically we want the first line number
    if (scenario.pickle && scenario.pickle.uri && scenario.pickle.locations) {
      const line = scenario.pickle.locations[0].line;
      const scenarioRef = `${scenario.pickle.uri}:${line}`;
      fs.appendFileSync(failedScenariosPath, scenarioRef + '\n');
    } else {
      // fallback if we can't get line number
      fs.appendFileSync(failedScenariosPath, scenario.pickle.uri + '\n');
    }
  }
});