const fs = require('fs');
const path = require('path');
const diff = require('diff');

const locatorsFolder = path.join(__dirname, '..', 'locators'); // Folder containing locator JSON files

// History folder for saving locator change history and passed element context.
const historyFolder = path.join(__dirname, '..', 'ElementHistory');
if (!fs.existsSync(historyFolder)) {
  fs.mkdirSync(historyFolder);
}
const historyPath = path.join(historyFolder, 'locatorHistory.json');
// File to save passed element context
const passedElementsPath = path.join(historyFolder, 'passedElements.json');
if (!fs.existsSync(passedElementsPath)) {
  fs.writeFileSync(passedElementsPath, JSON.stringify({}), 'utf-8');
}

// -------------------
// Helper Functions
// -------------------

// Update locator in all locator files that contain the failing selector.
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
}

// Log locator changes into history.
function logChange(oldLocator, newLocator, oldHtml, newHtml) {
  const history = JSON.parse(fs.existsSync(historyPath) ? fs.readFileSync(historyPath, 'utf-8') : '[]');
  const fixedOldHtml = oldHtml.replace(/"/g, "'");
  const fixedNewHtml = newHtml.replace(/"/g, "'");
  history.push({
    timestamp: new Date().toISOString(),
    oldLocator,
    newLocator,
    oldHtml: fixedOldHtml,
    newHtml: fixedNewHtml
  });
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

// Save passed element context (outerHTML, previous and next siblings) for a selector.
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

// Retrieve saved passed element context for a selector.
function getPassedElementContext(selector) {
  if (fs.existsSync(passedElementsPath)) {
    const passed = JSON.parse(fs.readFileSync(passedElementsPath, 'utf-8'));
    return passed[selector] ? passed[selector].context : null;
  }
  return null;
}

// Capture element context (outerHTML, previous and next sibling HTML) for a given selector.
async function captureElementContext(api, sel, isXpath) {
  let context = null;
  await api.execute(function (sel, isXpath) {
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

// Extract expected tag and attributes from the original selector.
function extractExpectedAttributes(originalSelector, isXpath) {
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

// Find the closest matching locator by scanning the entire DOM.
// Adds an extra bonus if the candidate's sibling context matches the saved context.
async function findClosestMatchingLocator(api, originalSelector, isXpath) {
  const { expectedTag, expectedAttrs } = extractExpectedAttributes(originalSelector, isXpath);
  let allDom = [];
  await api.execute(function () {
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
  const weightMap = { id: 5, type: 3, class: 3, text: 2 };
  const contextBonus = 2;
  // Retrieve saved context for the original selector, if any.
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
    // Compare previous and next sibling context if saved context is available.
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
    const tagName = bestMatch.tagName || expectedTag || 'unknown';
    let attrClauses = [];
    for (let attr in expectedAttrs) {
      if (bestMatch.attributes[attr]) {
        if (isXpath) {
          attrClauses.push(`@${attr}='${bestMatch.attributes[attr]}'`);
        } else {
          attrClauses.push(`[${attr}="${bestMatch.attributes[attr]}"]`);
        }
      }
    }
    if (isXpath) {
      return attrClauses.length > 0 ? `//${tagName}[${attrClauses.join(' and ')}]` : `//${tagName}`;
    } else {
      return attrClauses.length > 0 ? `${tagName}${attrClauses.join('')}` : tagName;
    }
  }
  return null;
}

// -------------------------
// Main Exported Function
// -------------------------

// The autoHeal function encapsulates the auto-healing logic. It is called from other custom commands.
async function autoHeal(api, selector) {
  const isXpath = selector.startsWith('//') || selector.startsWith('xpath=');
  // Retrieve old HTML for the failing locator.
  let oldHtmlResult = '';
  await api.execute(function (sel, isXpath) {
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
  // Use helper to find a new locator.
  const newSelector = await findClosestMatchingLocator(api, selector, isXpath);
  if (!newSelector) {
    throw new Error(`AutoHeal: Could not repair locator "${selector}"`);
  }
  console.log(`AutoHeal: Proposed new selector: "${newSelector}"`);
  // Retrieve new HTML.
  let newHtmlResult = '';
  await api.execute(function (sel, isXpath) {
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
  console.log(`AutoHeal: Auto-confirming new locator "${newSelector}".`);
  // Update locator in files.
  updateLocatorInFiles(selector, newSelector);
  logChange(selector, newSelector, oldHtml, newHtml);
  return newSelector;
}

module.exports = { autoHeal, captureElementContext, getPassedElementContext, savePassedElementContext };

async function captureElementContext(api, sel, isXpath) {
  let context = null;
  await api.execute(function (sel, isXpath) {
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

function getPassedElementContext(selector) {
  if (fs.existsSync(passedElementsPath)) {
    const passed = JSON.parse(fs.readFileSync(passedElementsPath, 'utf-8'));
    return passed[selector] ? passed[selector].context : null;
  }
  return null;
}

function savePassedElementContext(selector, context) {
  let passed = {};
  if (fs.existsSync(passedElementsPath)) {
    passed = JSON.parse(fs.readFileSync(passedElementsPath, 'utf-8'));
  }
  passed[selector] = { context, timestamp: new Date().toISOString() };
  fs.writeFileSync(passedElementsPath, JSON.stringify(passed, null, 2));
}