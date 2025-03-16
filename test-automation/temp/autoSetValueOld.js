const fs = require('fs');
const path = require('path');
const diff = require('diff');
const locatorsFolder = path.join(__dirname, '..', 'locators'); // Folder containing locator JSON files

// History folder for saving locator change history and passed element context.
const historyFolder = path.join(__dirname, '..', 'ElementHistory');
if (!fs.existsSync(historyFolder)) {
  fs.mkdirSync(historyFolder);
}
const locatorHistoryPath = path.join(historyFolder, 'locatorHistory.json');
const passedElementsPath = path.join(historyFolder, 'passedElements.json');

// Load all locators from files (merged)
function loadAllLocators() {
  const locatorFiles = fs.readdirSync(locatorsFolder).filter(file => file.endsWith('.json'));
  let merged = {};
  locatorFiles.forEach(file => {
    const filePath = path.join(locatorsFolder, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    merged = { ...merged, ...content };
  });
  return merged;
}
let locators = loadAllLocators();

// Helper: Save updated locator in all locator files that contain the failing selector.
function updateLocatorInFiles(selector, newSelector) {
  const locatorFiles = fs.readdirSync(locatorsFolder).filter(file => file.endsWith('.json'));
  locatorFiles.forEach(file => {
    const filePath = path.join(locatorsFolder, file);
    let content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let updated = false;
    function updateRecursively(obj) {
      for (let key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          updateRecursively(obj[key]);
        } else if (typeof obj[key] === 'string') {
          if (obj[key] === selector) {
            obj[key] = newSelector;
            updated = true;
          }
        }
      }
    }
    updateRecursively(content);
    if (updated) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
      console.log(`Updated locator in file ${file}`);
    }
  });
  locators = loadAllLocators();
}

// Helper: Log changes in locator history.
function logChange(oldLocator, newLocator, oldHtml, newHtml) {
  const history = JSON.parse(fs.existsSync(locatorHistoryPath) ? fs.readFileSync(locatorHistoryPath, 'utf-8') : '[]');
  // Replace inner double quotes with single quotes for readability.
  const fixedOldHtml = oldHtml.replace(/"/g, "'");
  const fixedNewHtml = newHtml.replace(/"/g, "'");
  history.push({
    timestamp: new Date().toISOString(),
    oldLocator,
    newLocator,
    oldHtml: fixedOldHtml,
    newHtml: fixedNewHtml
  });
  fs.writeFileSync(locatorHistoryPath, JSON.stringify(history, null, 2));
}

// Helper: Save passed element context (element + previous and next siblings) for a locator.
function savePassedElementContext(selector, contextObj) {
  let passed = {};
  if (fs.existsSync(passedElementsPath)) {
    passed = JSON.parse(fs.readFileSync(passedElementsPath, 'utf-8'));
  }
  passed[selector] = {
    context: contextObj,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(passedElementsPath, JSON.stringify(passed, null, 2));
}

// Helper: Retrieve saved passed element context for a locator.
function getPassedElementContext(selector) {
  if (fs.existsSync(passedElementsPath)) {
    const passed = JSON.parse(fs.readFileSync(passedElementsPath, 'utf-8'));
    return passed[selector] ? passed[selector].context : null;
  }
  return null;
}

module.exports = class CustomCommand {
  async command(selector, value) {
    let self = this.api;
    let allDom = [];
    const isXpath = selector.startsWith('//') || selector.startsWith('xpath=');

    // Ensure locator history file exists.
    if (!fs.existsSync(locatorHistoryPath)) {
      fs.writeFileSync(locatorHistoryPath, JSON.stringify([]), 'utf-8');
    }
    // Ensure passed elements file exists.
    if (!fs.existsSync(passedElementsPath)) {
      fs.writeFileSync(passedElementsPath, JSON.stringify({}), 'utf-8');
    }

    // Helper: Extract expected tag and attributes from the original selector.
    function extractExpectedAttributes(originalSelector) {
      let expectedTag = null;
      let expectedAttrs = {};
      if (isXpath) {
        const tagMatch = originalSelector.match(/^\/\/(\w+)/);
        if (tagMatch) {
          expectedTag = tagMatch[1].toLowerCase();
        }
        const attrRegex = /@([\w-]+)\s*=\s*["']([^"']+)["']/g;
        let match;
        while ((match = attrRegex.exec(originalSelector)) !== null) {
          expectedAttrs[match[1].toLowerCase()] = match[2];
        }
      } else {
        const tagMatch = originalSelector.match(/^(\w+)/);
        if (tagMatch) {
          expectedTag = tagMatch[1].toLowerCase();
        }
        const attrRegex = /\[([\w-]+)\s*=\s*["']([^"']+)["']\]/g;
        let match;
        while ((match = attrRegex.exec(originalSelector)) !== null) {
          expectedAttrs[match[1].toLowerCase()] = match[2];
        }
        if (originalSelector.startsWith('#')) {
          expectedAttrs['id'] = originalSelector.slice(1);
        }
      }
      return { expectedTag, expectedAttrs };
    }

    // Helper: Find the closest matching locator by scanning the DOM.
    // This uses the original scoring plus an extra bonus if the candidate's sibling context
    // matches the context of a previously passing element.
    async function findClosestMatchingLocator(originalSelector) {
      const { expectedTag, expectedAttrs } = extractExpectedAttributes(originalSelector);
      const isXpathLocal = originalSelector.startsWith('//') || originalSelector.startsWith('xpath=');
      await self.execute(function () {
        const allElems = document.querySelectorAll('*');
        return Array.from(allElems).map(el => {
          let attrs = {};
          for (let i = 0; i < el.attributes.length; i++) {
            let a = el.attributes[i];
            attrs[a.name.toLowerCase()] = a.value;
          }
          return {
            outerHTML: el.outerHTML,
            tagName: el.tagName.toLowerCase(),
            attributes: attrs,
            previousHTML: el.previousElementSibling ? el.previousElementSibling.outerHTML : null,
            nextHTML: el.nextElementSibling ? el.nextElementSibling.outerHTML : null
          };
        });
      }, [], function (result) {
        allDom = result.value;
      });
      let bestMatch = null;
      let bestScore = 0;
      // Weight mapping for attributes.
      const weightMap = { id: 5, type: 3, class: 3, text: 2 };
      // Extra bonus weight if context (previous/next element) matches.
      const contextBonus = 2;
      // Get saved context for this selector, if any.
      const savedContext = getPassedElementContext(originalSelector);
      allDom.forEach(domEl => {
        let score = 0;
        if (expectedTag && domEl.tagName === expectedTag) {
          score += 2;
        }
        for (let attr in expectedAttrs) {
          if (domEl.attributes[attr]) {
            if (domEl.attributes[attr] === expectedAttrs[attr]) {
              score += weightMap[attr] || 1;
            } else if (domEl.attributes[attr].includes(expectedAttrs[attr])) {
              score += (weightMap[attr] || 1) - 1;
            }
          }
        }
        if (expectedTag && domEl.outerHTML.toLowerCase().includes(expectedTag)) {
          score += 1;
        }
        // If saved context is available, compare previous and next siblings.
        if (savedContext) {
          if (savedContext.previousElement && domEl.previousHTML === savedContext.previousElement) {
            score += contextBonus;
          }
          if (savedContext.nextElement && domEl.nextHTML === savedContext.nextElement) {
            score += contextBonus;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestMatch = domEl;
        }
      });
      if (bestMatch) {
        const tagName = bestMatch.tagName || extractExpectedAttributes(originalSelector).expectedTag || 'unknown';
        // Build a compound locator using matching attributes.
        let attrClauses = [];
        for (let attr in expectedAttrs) {
          if (bestMatch.attributes[attr]) {
            if (isXpathLocal) {
              attrClauses.push(`@${attr}='${bestMatch.attributes[attr]}'`);
            } else {
              attrClauses.push(`[${attr}="${bestMatch.attributes[attr]}"]`);
            }
          }
        }
        if (isXpathLocal) {
          return attrClauses.length > 0 ? `//${tagName}[${attrClauses.join(' and ')}]` : `//${tagName}`;
        } else {
          return attrClauses.length > 0 ? `${tagName}${attrClauses.join('')}` : tagName;
        }
      }
      return null;
    }

    // Capture context from a successfully found element.
    async function captureElementContext(sel, isXpath) {
      let context = null;
      await self.execute(function (sel, isXpath) {
        let el;
        if (isXpath) {
          const res = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          el = res.singleNodeValue;
        } else {
          el = document.querySelector(sel);
        }
        if (el) {
          return {
            element: el.outerHTML,
            previousElement: el.previousElementSibling ? el.previousElementSibling.outerHTML : null,
            nextElement: el.nextElementSibling ? el.nextElementSibling.outerHTML : null
          };
        }
        return null;
      }, [sel, isXpath], function (result) {
        context = result.value;
      });
      return context;
    }

    // Switch locator strategy.
    if (isXpath) {
      await self.useXpath();
    } else {
      await self.useCss();
    }

    // Try to perform the action with the given selector.
    try {
      await self.waitForElementPresent(selector, 3000);
      await self.clearValue(selector);
      await self.setValue(selector, value);
      // On success, capture and save context.
      const context = await captureElementContext(selector, isXpath);
      if (context) {
        savePassedElementContext(selector, context);
      }
    } catch (err) {
      const isNoSuchElement =
        err.message &&
        (err.message.includes('no such element') ||
         err.message.includes('Unable to locate element') ||
         err.message.includes('not found') ||
         err.message.includes('Timed out while waiting for element'));
      if (!isNoSuchElement) {
        throw err;
      }
      console.log(`AutoHealer: Element not found for selector "${selector}". Attempting to repair...`);

      let oldHtmlResult = '';
      await self.execute(function (sel, isXpath) {
        if (isXpath) {
          const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const el = result.singleNodeValue;
          return el ? el.outerHTML : '';
        } else {
          const el = document.querySelector(sel);
          return el ? el.outerHTML : '';
        }
      }, [selector, isXpath], function (result) {
        oldHtmlResult = result.value;
      });
      let oldHtml = oldHtmlResult;

      const newSelector = await findClosestMatchingLocator(selector);
      if (!newSelector) {
        console.log(`AutoHealer: No alternative locator found for "${selector}".`);
        throw new Error(`AutoHealer: Could not repair locator "${selector}"`);
      }
      console.log(`AutoHealer: Proposed new selector: "${newSelector}"`);

      let newHtmlResult = '';
      await self.execute(function (sel, isXpath) {
        if (isXpath) {
          const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const el = result.singleNodeValue;
          return el ? el.outerHTML : '';
        } else {
          const el = document.querySelector(sel);
          return el ? el.outerHTML : '';
        }
      }, [newSelector, isXpath], function (result) {
        newHtmlResult = result.value;
      });
      let newHtml = newHtmlResult;
      const patch = diff.createPatch('element', oldHtml || '', newHtml || '');
      console.log('HTML Differences:\n', patch);
      console.log(`AutoHealer: Auto-confirming new locator "${newSelector}".`);

      updateLocatorInFiles(selector, newSelector);
      logChange(selector, newSelector, oldHtml, newHtml);

      await self.waitForElementPresent(newSelector, 3000);
      await self.clearValue(newSelector);
      await self.setValue(newSelector, value);
    }
  }
};