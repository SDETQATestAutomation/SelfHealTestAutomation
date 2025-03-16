const fs = require('fs');
const path = require('path');
const diff = require('diff');

// Folder containing locator JSON files.
const locatorsFolder = path.join(__dirname, '..', 'locators');

// History folder for saving locator change history and passed element context.
const historyFolder = path.join(__dirname, '..', 'ElementHistory');
if (!fs.existsSync(historyFolder)) {
  fs.mkdirSync(historyFolder);
}
const historyPath = path.join(historyFolder, 'locatorHistory.json');
// File to save passed element context.
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
      // Calculate DOM path and distance
      let path = [];
      let currentElement = el;
      while (currentElement && currentElement.tagName !== 'HTML') {
        let selector = currentElement.tagName.toLowerCase();
        let parent = currentElement.parentElement;
        if (parent) {
          let siblings = Array.from(parent.children);
          let index = siblings.indexOf(currentElement) + 1;
          if (siblings.length > 1) {
            selector += `:nth-child(${index})`;
          }
        }
        path.unshift(selector);
        currentElement = parent;
      }

      return {
        element: el.outerHTML,
        previousElement: el.previousElementSibling ? el.previousElementSibling.outerHTML : null,
        nextElement: el.nextElementSibling ? el.nextElementSibling.outerHTML : null,
        domPath: {
          path: path,
          distance: path.length
        }
      };
    }
    return null;
  }, [sel, isXpath], function (result) {
    context = result.value;
  });
  return context;
}

// A simple similarity function that returns a ratio (0 to 1) of common characters.
function similarity(s1, s2) {
  if (!s1 || !s2) return 0;
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  let common = 0;
  for (let char of s1) {
    if (s2.includes(char)) {
      common++;
    }
  }
  return common / Math.max(s1.length, s2.length);
}

// Extract expected tag and attributes from the original selector.
function extractExpectedAttributes(originalSelector, isXpath) {
  let expectedTag = null;
  let expectedAttrs = {};
  let expectedText = null;

  if (isXpath) {
    const tagMatch = originalSelector.match(/^\/\/(\w+)/);
    if (tagMatch) {
      expectedTag = tagMatch[1].toLowerCase();
    }
    
    // Handle text() function and contains(.) in XPath
    const textMatch = originalSelector.match(/text\(\)\s*=\s*['"]([^'"]+)['"]/);
    const containsMatch = originalSelector.match(/contains\s*\(\s*\.\s*,\s*['"]([^'"]+)['"]\s*\)/);
    
    if (textMatch) {
      expectedText = textMatch[1];
    } else if (containsMatch) {
      expectedText = containsMatch[1];
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
  return { expectedTag, expectedAttrs, expectedText };
}

function cleanupText(text) {
  if (!text) return '';
  
  // Split into words and filter out empty strings
  const words = text.split(/\s+/).filter(Boolean);
  
  // Process each word
  const cleanedWords = words.map(word => {
    // Basic cleaning - remove repeated characters
    let baseWord = '';
    let prevChar = '';
    let repeatCount = 0;
    
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (char === prevChar) {
        repeatCount++;
        if (repeatCount > 2) continue;
      } else {
        repeatCount = 0;
      }
      baseWord += char;
      prevChar = char;
    }
    
    return baseWord.replace(/[^\w\-\s]/g, '');
  });
  
  const result = cleanedWords.join(' ').trim();
  return result || text;
}

function findActualText(expectedText) {
  if (!expectedText) return '';
  
  // Get base form by removing repeated chars and special chars
  const baseText = cleanupText(expectedText);
  console.log('Original text:', expectedText);
  console.log('Cleaned text:', baseText);
  
  // If cleaning made the text empty, return original
  return baseText || expectedText;
}

// Add Levenshtein distance for better text comparison
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
    }
  }
  return 1 - (dp[m][n] / Math.max(m, n)); // Return similarity score between 0 and 1
}

// Add a new function to find the closest text match from available options
function findClosestTextMatch(targetText, availableTexts) {
  if (!targetText || !availableTexts || availableTexts.length === 0) return null;
  
  const cleanedTarget = cleanupText(targetText).toLowerCase();
  let bestMatch = null;
  let bestScore = -1;
  
  for (const text of availableTexts) {
    const cleanedText = cleanupText(text).toLowerCase();
    
    // Exact match after cleaning
    if (cleanedText === cleanedTarget) {
      return text; // Return original text with proper casing
    }
    
    // Check if cleaned target is contained within cleaned text
    if (cleanedText.includes(cleanedTarget) || cleanedTarget.includes(cleanedText)) {
      const score = levenshteinDistance(cleanedText, cleanedTarget);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = text;
      }
    }
  }
  
  return bestScore > 0.7 ? bestMatch : null; // Return match only if similarity is high enough
}

// Add a function to clean attribute values
function cleanupAttributeValue(value) {
  if (!value) return '';
  
  // Split into words and filter out empty strings
  const words = value.split(/\s+/).filter(Boolean);
  
  // Process each word
  const cleanedWords = words.map(word => {
    // Basic cleaning - remove repeated characters
    let baseWord = '';
    let prevChar = '';
    let repeatCount = 0;
    
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (char === prevChar) {
        repeatCount++;
        if (repeatCount > 2) continue;
      } else {
        repeatCount = 0;
      }
      baseWord += char;
      prevChar = char;
    }
    
    return baseWord;
  });
  
  return cleanedWords.join(' ').trim() || value;
}

// Add attribute patterns without hardcoded base words
const ATTRIBUTE_PATTERNS = {
  // Text attributes that should be cleaned and matched dynamically
  'title': { type: 'text' },
  'alt': { type: 'text' },
  'placeholder': { type: 'text' },
  'value': { type: 'text' },
  'aria-label': { type: 'text' },
  
  // ID patterns
  'id': { type: 'identifier', pattern: /^[a-zA-Z]+[a-zA-Z0-9_-]*$/ },
  
  // Class patterns
  'class': { type: 'list', separator: ' ' },
  
  // Name patterns
  'name': { type: 'identifier', pattern: /^[a-zA-Z]+[a-zA-Z0-9_-]*$/ },
  
  // Data attributes
  'data-test': { type: 'identifier', pattern: /^[a-zA-Z]+[a-zA-Z0-9_-]*$/ },
  'data-testid': { type: 'identifier', pattern: /^[a-zA-Z]+[a-zA-Z0-9_-]*$/ },
  
  // URL patterns
  'href': { type: 'url', pattern: /^[/#]|https?:\/\// },
  'src': { type: 'url', pattern: /^[/#]|https?:\/\// }
};

// Add function to find closest matching value from available options
function findClosestAttributeMatch(targetValue, availableValues) {
  if (!targetValue || !availableValues || availableValues.length === 0) return null;
  
  const cleanedTarget = cleanupText(targetValue).toLowerCase();
  let bestMatch = null;
  let bestScore = -1;
  
  for (const value of availableValues) {
    const cleanedValue = cleanupText(value).toLowerCase();
    
    // Exact match after cleaning
    if (cleanedValue === cleanedTarget) {
      return value; // Return original value with proper casing
    }
    
    // Check if cleaned target is contained within cleaned value or vice versa
    if (cleanedValue.includes(cleanedTarget) || cleanedTarget.includes(cleanedValue)) {
      const score = levenshteinDistance(cleanedValue, cleanedTarget);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = value;
      }
    }
  }
  
  return bestScore > 0.7 ? bestMatch : null;
}

// Modify the cleanAttributeValueByType function to use dynamic matching
function cleanAttributeValueByType(attrName, value, availableValues = []) {
  if (!value) return '';
  
  const pattern = ATTRIBUTE_PATTERNS[attrName.toLowerCase()];
  if (!pattern) {
    return cleanupText(value);
  }
  
  switch (pattern.type) {
    case 'text':
      // First try to find a close match from available values
      const closestMatch = findClosestAttributeMatch(value, availableValues);
      if (closestMatch) {
        return closestMatch;
      }
      return cleanupText(value);
      
    case 'identifier':
      return value.replace(/[^\w-]/g, '').replace(/[-_]+/g, '-');
      
    case 'list':
      return value.split(pattern.separator)
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => cleanupText(item))
        .join(pattern.separator);
      
    case 'url':
      try {
        if (value.startsWith('/') || value.startsWith('#')) {
          return value;
        }
        const url = new URL(value);
        return url.toString();
      } catch {
        return value;
      }
      
    default:
      return cleanupText(value);
  }
}

// Add function to find closest text content match
function findClosestTextContentMatch(targetText, elements) {
  if (!targetText || !elements || elements.length === 0) return null;
  
  const cleanedTarget = cleanupText(targetText).toLowerCase();
  let bestMatch = null;
  let bestScore = -1;
  
  for (const el of elements) {
    const textContent = el.textContent || '';
    const cleanedText = cleanupText(textContent).toLowerCase();
    
    // Exact match after cleaning
    if (cleanedText === cleanedTarget) {
      return { element: el, score: 1, text: textContent };
    }
    
    // Check if cleaned target is contained within cleaned text
    if (cleanedText.includes(cleanedTarget) || cleanedTarget.includes(cleanedText)) {
      const score = levenshteinDistance(cleanedText, cleanedTarget);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { element: el, score: score, text: textContent };
      }
    }
  }
  
  return bestScore > 0.6 ? bestMatch : null;
}

// Modify findClosestMatchingLocator to handle text content
async function findClosestMatchingLocator(api, originalSelector, isXpath) {
  const { expectedTag, expectedAttrs, expectedText } = extractExpectedAttributes(originalSelector, isXpath);
  console.log('Looking for tag:', expectedTag);
  console.log('Looking for attributes:', expectedAttrs);
  console.log('Looking for text:', expectedText);
  
  let allDom = [];
  
  await api.execute(function (tag, attrs, expectedText, patterns) {
    console.log('Searching DOM with:', { tag, attrs, expectedText });
    const matches = [];
    
    // Helper function to clean text content
    function cleanTextContent(text) {
      if (!text) return '';
      return text.replace(/(.)\1+/g, '$1').trim();
    }
    
    // Collect all elements with matching tag
    const elements = tag ? 
      document.getElementsByTagName(tag) : 
      document.getElementsByTagName('*');
    
    // If we're looking for text content
    if (expectedText) {
      const cleanedExpectedText = cleanTextContent(expectedText);
      console.log('Looking for text content:', {
        original: expectedText,
        cleaned: cleanedExpectedText
      });
      
      // Collect all text content for comparison
      const availableTexts = new Set();
      for (let el of elements) {
        const text = el.textContent ? el.textContent.trim() : '';
        if (text) {
          availableTexts.add(text);
        }
      }
      
      console.log('Available text contents:', Array.from(availableTexts).slice(0, 5));
      
      // Find elements with matching text content
      for (let el of elements) {
        const actualText = el.textContent ? el.textContent.trim() : '';
        if (actualText) {
          const cleanedActual = cleanTextContent(actualText);
          
          let textScore = 0;
          const normalizedExpected = cleanedExpectedText.toLowerCase();
          const normalizedActual = cleanedActual.toLowerCase();
          
          // Check for exact match after cleaning
          if (normalizedActual === normalizedExpected) {
            textScore = 100;
          } 
          // Check if one contains the other
          else if (normalizedActual.includes(normalizedExpected) || 
                   normalizedExpected.includes(normalizedActual)) {
            textScore = 90;
          } 
          // Check for word-level matches
          else {
            const expectedWords = normalizedExpected.split(/\s+/);
            const actualWords = normalizedActual.split(/\s+/);
            
            let matchedWords = 0;
            for (const word of expectedWords) {
              if (actualWords.some(w => w.includes(word) || word.includes(w))) {
                matchedWords++;
              }
            }
            
            if (matchedWords > 0) {
              textScore = (matchedWords / expectedWords.length) * 80;
            }
          }
          
          if (textScore > 0) {
            matches.push({
              element: el,
              score: textScore,
              text: actualText,
              attributes: Array.from(el.attributes).reduce((acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              }, {})
            });
          }
        }
      }
    }
    
    // Sort matches by score
    matches.sort((a, b) => b.score - a.score);
    
    console.log('Found matches:', matches.slice(0, 5).map(m => ({
      tag: m.element.tagName,
      text: m.text,
      score: m.score
    })));
    
    return matches.slice(0, 5);
  }, [expectedTag, expectedAttrs, expectedText, ATTRIBUTE_PATTERNS], function(result) {
    allDom = result.value || [];
  });
  
  if (allDom.length > 0) {
    const bestMatch = allDom[0];
    if (bestMatch) {
      if (isXpath) {
        // For text content in TD tags, use contains() for better matching
        if (expectedTag === 'td' && bestMatch.text) {
          // Clean up the text content for the selector
          const selectorText = bestMatch.text.replace(/'/g, "\\'").trim();
          const newSelector = `//${expectedTag}[contains(.,'${selectorText}')]`;
          console.log('Generated new selector:', newSelector);
          return newSelector;
        }
        
        // For other cases, construct selector with attributes
        const attrClauses = [];
        for (const [attrName, attrValue] of Object.entries(bestMatch.attributes)) {
          if (expectedAttrs[attrName.toLowerCase()]) {
            attrClauses.push(`@${attrName}='${attrValue}'`);
          }
        }
        if (bestMatch.text) {
          attrClauses.push(`contains(.,'${bestMatch.text.replace(/'/g, "\\'")}')`);
        }
        const newSelector = `//${expectedTag}[${attrClauses.join(' and ')}]`;
        console.log('Generated new selector:', newSelector);
        return newSelector;
      }
    }
  }
  
  console.log('Warning: No valid matches found, returning original selector');
  return originalSelector;
}

// -------------------------
// Main Exported Function
// -------------------------

// The autoHeal function encapsulates the auto-healing logic.
async function autoHeal(api, selector) {
  const isXpath = selector.startsWith('//') || selector.startsWith('xpath=');
  
  // First try to find the element and save its context if found
  let elementFound = false;
  await api.execute(function(sel, isXpath) {
    if (isXpath) {
      const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return !!result.singleNodeValue;
    } else {
      return !!document.querySelector(sel);
    }
  }, [selector, isXpath], function(result) {
    elementFound = result.value;
  });

  if (elementFound) {
    // Save the context including DOM path
    const context = await captureElementContext(api, selector, isXpath);
    if (context) {
      savePassedElementContext(selector, context);
    }
    return selector;
  }

  // If element not found, proceed with auto-healing
  const newSelector = await findClosestMatchingLocator(api, selector, isXpath);
  if (!newSelector) {
    throw new Error(`AutoHeal: Could not repair locator "${selector}"`);
  }
  
  // Verify the new selector actually finds an element
  let newElementFound = false;
  await api.execute(function(sel, isXpath) {
    if (isXpath) {
      const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return !!result.singleNodeValue;
    } else {
      return !!document.querySelector(sel);
    }
  }, [newSelector, isXpath], function(result) {
    newElementFound = result.value;
  });

  if (!newElementFound) {
    console.log(`AutoHeal: Warning - Generated selector "${newSelector}" did not find any element. Falling back to original logic.`);
    // Fall back to original similarity-based matching
    return await findClosestMatchingLocator(api, selector, isXpath, true);
  }

  console.log(`AutoHeal: Proposed new selector: "${newSelector}"`);
  
  // Get old and new HTML for logging
  let [oldHtml, newHtml] = await Promise.all([
    getElementHtml(api, selector, isXpath),
    getElementHtml(api, newSelector, isXpath)
  ]);
  
  const patch = diff.createPatch('element', oldHtml || '', newHtml || '');
  console.log('HTML Differences:\n', patch);
  console.log(`AutoHeal: Auto-confirming new locator "${newSelector}".`);
  
  // Update locator in all locator files
  updateLocatorInFiles(selector, newSelector);
  logChange(selector, newSelector, oldHtml, newHtml);
  
  return newSelector;
}

// Helper function to get element HTML
async function getElementHtml(api, selector, isXpath) {
  let html = '';
  await api.execute(function(sel, isXpath) {
    if (isXpath) {
      const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const el = result.singleNodeValue;
      return el ? el.outerHTML : '';
    } else {
      const el = document.querySelector(sel);
      return el ? el.outerHTML : '';
    }
  }, [selector, isXpath], function(result) {
    html = result.value;
  });
  return html;
}

module.exports = { autoHeal, captureElementContext, getPassedElementContext, savePassedElementContext };

function calculateDomPath(element) {
  let path = [];
  let currentElement = element;
  
  while (currentElement && currentElement.tagName !== 'HTML') {
    let selector = currentElement.tagName.toLowerCase();
    let parent = currentElement.parentElement;
    
    if (parent) {
      let siblings = Array.from(parent.children);
      let index = siblings.indexOf(currentElement) + 1;
      if (siblings.length > 1) {
        selector += `:nth-child(${index})`;
      }
    }
    
    path.unshift(selector);
    currentElement = parent;
  }
  
  return {
    path: path,
    distance: path.length
  };
}