@ParabankApplication

Feature: Parabank Application

    @ParabankApplication-Scenario-1
    Scenario: Check Login Scenario
        Given I open parabank login page
        When I enter valid credentials for parabank
        And I click on the login button for parabank

    @ParabankApplication-Scenario-2
    Scenario: Check Link Text Scenario
        Given I open parabank login page
        And I click register parabank login page

    @ParabankApplication-Scenario-3
    Scenario: Check Image Scenario
        Given I open parabank login page
        And I check paranbank image is present

    @ParabankApplication-Scenario-4
    Scenario: Check Table Scenario
        Given I open parabank login page
        When I click read more link
        And I check data in table
        