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
      let scenarioTags = [];
      if (
        scenario.pickle &&
        scenario.pickle.tags &&
        scenario.gherkinDocument &&
        scenario.gherkinDocument.feature &&
        scenario.gherkinDocument.feature.tags
      ) {
        // Get feature-level tags (each tag object has a 'name' property)
        const featureTags = scenario.gherkinDocument.feature.tags.map(tag => tag.name);
        // Filter scenario tags: only include those that are NOT in featureTags.
        scenarioTags = scenario.pickle.tags
          .map(tag => tag.name)
          .filter(tagName => !featureTags.includes(tagName));
      } else if (scenario.pickle && scenario.pickle.tags && scenario.pickle.tags.length > 0) {
        scenarioTags = scenario.pickle.tags.map(tag => tag.name);
      }
      if (scenarioTags.length > 0) {
        fs.appendFileSync(failedScenariosPath, scenarioTags.join(' ') + '\n');
      } else if (scenario.pickle && scenario.pickle.uri && scenario.pickle.locations) {
        const line = scenario.pickle.locations[0].line;
        const scenarioRef = `${scenario.pickle.uri}:${line}`;
        fs.appendFileSync(failedScenariosPath, scenarioRef + '\n');
      }
    }
  });