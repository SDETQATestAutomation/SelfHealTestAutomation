@ParabankLogin

Feature: Parabank Login

    @ParabankLogin-Scenario-1
    Scenario: Successful login
        Given I open parabank login page
        When I click read more link
        And I check data in table
        
        #When I click register parabank login page
        #When I enter valid credentials for parabank
        #And I click on the login button for parabank
        #Then I should see the landing page