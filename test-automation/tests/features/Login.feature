@Login

Feature: Login

    @Login-Scenario-1
    Scenario: Successful login
        Given I open the login page
        When I enter valid credentials
        And I click on the login button
        Then I should see the landing page