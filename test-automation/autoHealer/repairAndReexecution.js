const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const failedScenariosFile = path.join(__dirname, '..', 'failed_scenarios.txt');

function runNightwatch() {
  console.log('Running Nightwatch to retest failed scenarios...');
  const result = spawnSync('npx', ['nightwatch'], {
    stdio: 'inherit',
    env: process.env
  });
  return result.status; // 0 if success
}

function main() {
  if (!fs.existsSync(failedScenariosFile)) {
    console.log('No failed scenarios found. Exiting repair process.');
    return;
  }

  let attempts = 0;
  const maxAttempts = 3; // Adjust as needed

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n=== Repair and Re-Execution Attempt #${attempts} ===\n`);

    // Clear or rename the file so we capture new failures
    if (fs.existsSync(failedScenariosFile)) {
      fs.unlinkSync(failedScenariosFile);
    }

    // Re-run Nightwatch
    const exitCode = runNightwatch();

    if (exitCode === 0) {
      console.log('All tests passed after repair attempts!');
      break;
    }

    if (!fs.existsSync(failedScenariosFile)) {
      console.log('No new failures recorded. Stopping re-run attempts.');
      break;
    } else {
      const newFailures = fs.readFileSync(failedScenariosFile, 'utf-8').trim();
      if (!newFailures) {
        console.log('Failed scenarios file is empty. Stopping re-run attempts.');
        break;
      }
      console.log('New failed scenarios:\n', newFailures);
      // The loop continues until we reach maxAttempts or success
    }
  }

  console.log('Repair and Re-execution flow complete.');
}

main();