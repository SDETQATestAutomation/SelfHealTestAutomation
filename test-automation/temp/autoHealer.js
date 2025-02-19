// const { browser } = require('nightwatch');
// const fs = require('fs');
// const path = require('path');
// const diff = require('diff');

// const locatorsPath = path.join(__dirname, '..', 'locators', 'loginLocators.json');
// const historyPath = path.join(__dirname, 'locatorHistory.json');

// // Load existing locators
// let locators = require('../locators/loginLocators.json');

// // Ensure history file exists
// if (!fs.existsSync(historyPath)) {
//   fs.writeFileSync(historyPath, JSON.stringify([]), 'utf-8');
// }

// // Save updated locators
// function saveLocators(updatedLocators) {
//   fs.writeFileSync(locatorsPath, JSON.stringify(updatedLocators, null, 2), 'utf-8');
//   locators = updatedLocators;
// }

// // Log changes in locatorHistory.json
// function logChange(oldLocator, newLocator, oldHtml, newHtml) {
//   const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
//   history.push({
//     timestamp: new Date().toISOString(),
//     oldLocator,
//     newLocator,
//     oldHtml,
//     newHtml
//   });
//   fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
// }

// /**
//  * If you want user confirmation in real time, you could integrate a prompt or skip this altogether.
//  * Here, we auto-confirm 'yes' for demonstration.
//  */
// function getUserConfirmation(oldLocator, newLocator) {
//   console.log(`
//     *** Attempting to fix locator ***
//     Old Locator: ${oldLocator}
//     Proposed New Locator: ${newLocator}
//     Auto-confirming 'yes'...
//   `);
//   return 'yes';
// }

// // Find the closest matching locator by scanning the DOM
// async function findClosestMatchingLocator(originalLocator) {
//   // Use "elements.value" in Nightwatch 3 (instead of elements.result.value)
//   const { value: allDom = [] } = await browser.execute(function() {
//     const allElems = document.querySelectorAll('*');
//     return Array.from(allElems).map(el => ({
//       outerHTML: el.outerHTML,
//       id: el.id,
//       className: el.className,
//       tagName: el.tagName
//     }));
//   });

//   let bestMatch = null;
//   let bestScore = 0;
//   const partial = originalLocator.replace(/['"\[\]\(\)=]/g, '');

//   allDom.forEach(domEl => {
//     let score = 0;
//     if (domEl.outerHTML.toLowerCase().includes(partial.toLowerCase())) {
//       score++;
//     }
//     if (score > bestScore) {
//       bestScore = score;
//       bestMatch = domEl;
//     }
//   });

//   return bestMatch;
// }

// function highlightHtmlChanges(oldHtml, newHtml) {
//   const patch = diff.createPatch('element', oldHtml || '', newHtml || '');
//   return patch;
// }

// async function attemptAction(locator, actionFn) {
//   try {
//     // Wait for the element to be present, then perform the action
//     await browser.waitForElementPresent(locator, 3000);
//     await actionFn(locator);
//   } catch (err) {
//     const isNoSuchElement =
//       err.message &&
//       (err.message.includes('no such element') || err.message.includes('Unable to locate element'));

//     if (!isNoSuchElement) {
//       // Not a missing element error; rethrow
//       throw err;
//     }

//     console.log(`AutoHealer: Element not found for locator "${locator}". Attempting to repair...`);

//     // Capture old HTML if any
//     let oldHtml = '';
//     try {
//       // For NW 3, result is under "res.value"
//       const { value } = await browser.execute(function(sel) {
//         const el = document.querySelector(sel);
//         return el ? el.outerHTML : '';
//       }, [locator]);
//       oldHtml = value;
//     } catch (e) {
//       oldHtml = 'Could not retrieve old HTML.';
//     }

//     // Find a new locator
//     const bestMatch = await findClosestMatchingLocator(locator);
//     if (!bestMatch) {
//       console.log(`No close match found for "${locator}".`);
//       throw new Error(`AutoHealer: No match found for locator "${locator}"`);
//     }

//     // Construct a new locator from the best match
//     const newLocator = bestMatch.id
//       ? `#${bestMatch.id}`
//       : bestMatch.tagName.toLowerCase();

//     console.log(`Proposed new locator => "${newLocator}"`);
//     const newHtml = bestMatch.outerHTML;
//     const patch = highlightHtmlChanges(oldHtml, newHtml);
//     console.log('HTML Differences:\n', patch);

//     const userChoice = getUserConfirmation(locator, newLocator);
//     if (userChoice === 'yes') {
//       // Update locator in JSON
//       Object.keys(locators.loginPage).forEach(key => {
//         if (locators.loginPage[key] === locator) {
//           locators.loginPage[key] = newLocator;
//         }
//       });
//       saveLocators(locators);

//       // Log changes
//       logChange(locator, newLocator, oldHtml, newHtml);

//       // Retry with new locator
//       await browser.waitForElementPresent(newLocator, 3000);
//       await actionFn(newLocator);
//     } else {
//       console.log(`User declined the new locator. Skipping step for "${locator}"`);
//       throw new Error(`AutoHealer: Step removed for locator "${locator}".`);
//     }
//   }
// }

// module.exports = {
//   async click(locator) {
//     // Called from a test scenario or step definition
//     await attemptAction(locator, async (sel) => {
//       await browser.click(sel);
//     });
//   },

//   async setValue(locator, value) {
//     // Called from a test scenario or step definition
//     await attemptAction(locator, async (sel) => {
//       await browser.clearValue(sel);
//       await browser.setValue(sel, value);
//     });
//   }
// };