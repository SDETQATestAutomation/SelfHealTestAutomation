const { Given, When, Then } = require('@cucumber/cucumber');
const locators = require('../../locators/parabankLocators.json');
const autoHealer = require('../../temp/autoHealer');

Given('I open parabank login page', async () => {
  await browser.url('https://parabank.parasoft.com/parabank/index.htm');
  await browser.waitForElementVisible('//body', 5000);
});

When('I enter valid credentials for parabank', async () => {
  await browser.autoSetValue(locators.parabank.usernameInput, 'john');
  await browser.autoSetValue(locators.parabank.passwordInput, 'password');
});

When('I click on the login button for parabank', async () => {
  await browser.autoClick(locators.parabank.loginButton);
  await browser.pause(5000);
});

Then('I should see the landing page', async () => {
  await browser.waitForElementVisible('//h1', 5000);
  await browser.assert.containsText('//h1', 'Welcome to Self Heal Test Automation!');
});

When('I click register parabank login page', async () => {
  await browser.autoClick(locators.parabank.registerLink);
  await browser.pause(5000);
});

When('I check paranbank image is present', async () => {
  await browser.autoWiatForElement(locators.parabank.image_parabank);
  await browser.pause(5000);
});


When('I click read more link', async () => {
  await browser.autoClick(locators.parabank.read_more_link);
  await browser.pause(5000);
});

When('I check data in table', async () => {
  await browser.autoWiatForElement(locators.parabank.table_data);
  await browser.pause(5000);
});

