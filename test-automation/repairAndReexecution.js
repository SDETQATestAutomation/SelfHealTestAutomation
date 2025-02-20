const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Path to the failed scenarios file.
// Adjust the path if your tests folder is located differently.
const failedScenariosFile = path.join(__dirname, 'tests', 'failed_scenarios.txt');

function runNightwatch(argsArray) {
  console.log('Running Nightwatch with arguments:', argsArray.join(' '));
  const result = spawnSync('node', argsArray, {
    stdio: 'inherit',
    env: process.env
  });
  return result.status; // 0 indicates success
}

function main() {
  if (!fs.existsSync(failedScenariosFile)) {
    console.log('No failed scenarios file found. Exiting repair process.');
    return;
  }

  let attempts = 0;
  const maxAttempts = 3; // Maximum re-run attempts.
  // Read initial failures from file.
  let previousFailures = fs.readFileSync(failedScenariosFile, 'utf-8').trim();

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n=== Repair and Re-Execution Attempt #${attempts} ===\n`);

    let failedContent = '';
    if (fs.existsSync(failedScenariosFile)) {
      failedContent = fs.readFileSync(failedScenariosFile, 'utf-8').trim();
    }
    // Reuse previous failures if file is empty.
    if (!failedContent && previousFailures) {
      failedContent = previousFailures;
    }
    if (!failedContent) {
      console.log('No failures to re-run. Stopping attempts.');
      break;
    }

    // Get the first non-empty line.
    const firstLine = failedContent.split('\n').find(line => line.trim().length > 0);
    let args = ['nightwatch.js', '-c', 'config/nightwatch.conf.js', '--browser', 'chrome'];
    
    // If first line starts with "@", assume these are scenario tags.
    if (firstLine.startsWith('@')) {
      const tags = failedContent.split('\n').map(line => line.trim()).filter(Boolean).join(' ');
      console.log('Using scenario tags:', tags);
      args.push('--tags', tags);
    }
    // Otherwise, if it contains ".feature", assume these are feature file paths.
    else if (firstLine.includes('.feature')) {
      let filePaths = failedContent
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(p => p.startsWith('tests/') ? p.replace(/^tests\//, '') : p);
      console.log('Using normalized feature file paths:', filePaths.join(' '));
      args = args.concat(filePaths);
    }
    // Fallback: treat content as tags.
    else {
      const tags = failedContent.split('\n').map(line => line.trim()).filter(Boolean).join(' ');
      console.log('Using fallback tags:', tags);
      args.push('--tags', tags);
    }

    // Save current failures for reuse.
    previousFailures = failedContent;
    
    // Clear the failed scenarios file so new failures can be captured.
    try {
      fs.unlinkSync(failedScenariosFile);
    } catch (e) {
      // Continue if file doesn't exist.
    }

    const exitCode = runNightwatch(args);
    if (exitCode === 0) {
      console.log('All tests passed after repair attempts!');
      break;
    }

    // After the run, try to read new failures.
    if (!fs.existsSync(failedScenariosFile)) {
      console.log('No new failures recorded, reusing previous failures for next attempt.');
    } else {
      const newFailures = fs.readFileSync(failedScenariosFile, 'utf-8').trim();
      if (newFailures) {
        previousFailures = newFailures;
      } else {
        console.log('Failed scenarios file is empty. Reusing previous failures for next attempt.');
      }
    }
  }
  console.log('Repair and Re-Execution flow complete.');
}

main();