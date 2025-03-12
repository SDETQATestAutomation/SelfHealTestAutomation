const diff = require('diff');

module.exports.command = async function(selector) {
  const browser = this; // 'this' is the Nightwatch browser instance

  // Helper: Find a closest matching locator by scanning the DOM
  async function findClosestMatchingLocator(originalSelector) {
    // Execute a script in the browser to get all elements
    const { value: allDom = [] } = await browser.execute(function() {
      const allElems = document.querySelectorAll('*');
      return Array.from(allElems).map(el => ({
        outerHTML: el.outerHTML,
        id: el.id,
        tagName: el.tagName
      }));
    });
    let bestMatch = null;
    let bestScore = 0;
    // Remove special characters from the original selector
    const partial = originalSelector.replace(/['"\[\]\(\)=]/g, '');
    allDom.forEach(domEl => {
      let score = 0;
      if (domEl.outerHTML.toLowerCase().includes(partial.toLowerCase())) {
        score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = domEl;
      }
    });
    if (bestMatch) {
      return bestMatch.id ? `#${bestMatch.id}` : bestMatch.tagName.toLowerCase();
    }
    return null;
  }

  // Main command logic: try to click the element, then auto-heal if not found.
  try {
    await browser.waitForElementPresent(selector, 3000);
    await browser.click(selector);
  } catch (err) {
    const isNoSuchElement =
      err.message &&
      (err.message.includes('no such element') || err.message.includes('Unable to locate element'));
    if (!isNoSuchElement) {
      throw err;
    }
    console.log(`AutoHealer: Element not found for selector "${selector}". Attempting to repair...`);

    // Capture old HTML for diff reporting
    let oldHtml = '';
    try {
      const { value } = await browser.execute(function(sel) {
        const el = document.querySelector(sel);
        return el ? el.outerHTML : '';
      }, [selector]);
      oldHtml = value;
    } catch (e) {
      oldHtml = 'Could not retrieve old HTML.';
    }

    // Attempt to find a new selector
    const newSelector = await findClosestMatchingLocator(selector);
    if (!newSelector) {
      console.log(`AutoHealer: No alternative locator found for "${selector}".`);
      throw new Error(`AutoHealer: Could not repair locator "${selector}"`);
    }
    console.log(`AutoHealer: Proposed new selector: "${newSelector}"`);

    // Get new HTML for diff reporting
    const { value: newHtml } = await browser.execute(function(sel) {
      const el = document.querySelector(sel);
      return el ? el.outerHTML : '';
    }, [newSelector]);
    const patch = diff.createPatch('element', oldHtml || '', newHtml || '');
    console.log('HTML Differences:\n', patch);

    // For this example, we auto-confirm the new locator.
    console.log(`AutoHealer: Auto-confirming new locator "${newSelector}".`);

    // Retry with the new selector
    await browser.waitForElementPresent(newSelector, 3000);
    await browser.click(newSelector);
  }
  return this;
};