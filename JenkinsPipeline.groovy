pipeline {
    // Use the Built-In Node for execution
    agent { label 'Built-In Node' }
    
    environment {
        // Repository details
        REPO_URL = 'https://github.com/SDETQATestAutomation/SelfHealTestAutomation.git'
        BRANCH = 'Main'
        
        // Directory names for your projects
        BACKEND_DIR = 'backend'
        FRONTEND_DIR = 'frontend'
        
        // Notification email address
        RECIPIENT_EMAIL = 'prashant.ranjan.qa@gmail.com'
    }
    
    stages {
        stage('Checkout') {
            steps {
                // Delete the current workspace to force a fresh clone
                deleteDir()
                
                // Checkout the repository using the initialized variables
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${BRANCH}"]],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [],
                    userRemoteConfigs: [[url: "${REPO_URL}"]]
                ])
            }
        }
        stage('Build Backend') {
            steps {
                // Change to the backend directory, install dependencies
                dir("${BACKEND_DIR}") {
                    sh 'npm install'
                    // Uncomment and add build command if needed, e.g., sh 'npm run build'
                }
            }
        }
        stage('Build Frontend') {
            steps {
                // Change to the frontend directory, install dependencies, and build the React app
                dir("${FRONTEND_DIR}") {
                    sh 'npm install'
                    sh 'npm run build'
                }
            }
        }
    }
    
    post {
        success {
            emailext(
                subject: "SUCCESS: Build #${env.BUILD_NUMBER} - ${env.JOB_NAME}",
                body: """
                    <html>
                    <body>
                      <h2>Build Successful</h2>
                      <p><strong>Job:</strong> ${env.JOB_NAME}</p>
                      <p><strong>Build Number:</strong> ${env.BUILD_NUMBER}</p>
                      <p><strong>Build URL:</strong> <a href="${env.BUILD_URL}">${env.BUILD_URL}</a></p>
                      <p><strong>Changes:</strong></p>
                      <ul>
                        ${currentBuild.changeSets.collect { changeSet ->
                          changeSet.items.collect { item ->
                              "<li>${item.msg} by ${item.author}</li>"
                          }.join("")
                        }.join("")}
                      </ul>
                    </body>
                    </html>
                """,
                to: "${RECIPIENT_EMAIL}"
            )
        }
        failure {
            emailext(
                subject: "FAILURE: Build #${env.BUILD_NUMBER} - ${env.JOB_NAME}",
                body: """
                    <html>
                    <body>
                      <h2>Build Failed</h2>
                      <p><strong>Job:</strong> ${env.JOB_NAME}</p>
                      <p><strong>Build Number:</strong> ${env.BUILD_NUMBER}</p>
                      <p><strong>Build URL:</strong> <a href="${env.BUILD_URL}">${env.BUILD_URL}</a></p>
                      <p>Please check the console output for details.</p>
                    </body>
                    </html>
                """,
                to: "${RECIPIENT_EMAIL}"
            )
        }
        always {
            echo "Build complete."
        }
    }
}