const { Given, When, Then } = require('@cucumber/cucumber');
const locators = require('../../locators/loginLocators.json');
const autoHealer = require('../../temp/autoHealer');

Given('I open the login page', async () => {
  await browser.url('http://localhost:3000');
  await browser.waitForElementVisible('//body', 5000);
});

When('I enter valid credentials', async () => {
  await browser.autoSetValue(locators.loginPage.emailInput, 'prashant.ranjan@gmail.com');
  await browser.autoSetValue(locators.loginPage.passwordInput, 'password123');
});

When('I click on the login button', async () => {
  await browser.autoClick(locators.loginPage.loginButton);
});

Then('I should see the landing page', async () => {
  await browser.waitForElementVisible('//h1', 5000);
  await browser.assert.containsText('//h1', 'Welcome to Self Heal Test Automation!');
});