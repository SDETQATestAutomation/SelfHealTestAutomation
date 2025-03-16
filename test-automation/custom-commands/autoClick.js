const { autoHeal, captureElementContext, savePassedElementContext } = require('../autoHeal/repairAndRestore');

module.exports = class CustomCommand {
  async command(selector, value) {
    let self = this.api;
    const isXpath = selector.startsWith('//') || selector.startsWith('xpath=');
    try {
      await self.waitForElementPresent(selector, 3000);
      await self.click(selector);
      // On success, capture context and save it.
      const context = await captureElementContext(self, selector, isXpath);
      if (context) {
        savePassedElementContext(selector, context);
      }
    } catch (err) {
      const isNoSuchElement = err.message && 
        (err.message.includes('no such element') ||
         err.message.includes('Unable to locate element') ||
         err.message.includes('not found') ||
         err.message.includes('Timed out while waiting for element'));
      if (!isNoSuchElement) {
        throw err;
      }
      console.log(`autoSetValue: Element not found for selector "${selector}". Initiating auto-heal...`);
      const newSelector = await autoHeal(self, selector);
      await self.waitForElementPresent(newSelector, 3000);
      await self.click(newSelector);
    }
  }
};