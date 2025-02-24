pipeline {
  agent { label 'PrashantMacJenkinsNode' }
  
  parameters {
    string(name: 'NIGHTWATCH_CONFIG', defaultValue: 'config/nightwatch.conf.js', description: 'Path to Nightwatch configuration file')
    string(name: 'BROWSER', defaultValue: 'chrome', description: 'Browser to run tests')
    string(name: 'TAGS', defaultValue: 'Login-Scenario-1', description: 'Cucumber tags to run')
  }
  
  environment {
    REPO_URL = 'https://github.com/SDETQATestAutomation/SelfHealTestAutomation.git'
    BRANCH = 'Main'
    BACKEND_DIR = 'backend'
    FRONTEND_DIR = 'frontend'
    TEST_DIR = 'test-automation'
    RECIPIENT_EMAIL = 'prashant.ranjan.qa@gmail.com'
  }
  
  tools {
    // Use NodeJs tool configured in Jenkins Global Tool Configuration
    nodejs "NodeJS"
  }
  
  stages {
    stage('Checkout') {
      steps {
        // Clean workspace and checkout fresh code.
        deleteDir()
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
        dir("${BACKEND_DIR}") {
          sh 'npm install'
          // Uncomment if needed: sh 'npm run build'
        }
      }
    }
    
    stage('Build Frontend') {
      steps {
        dir("${FRONTEND_DIR}") {
          sh 'npm install'
          sh 'npm run build'
        }
      }
    }
    
    stage('Install Test Automation Dependencies') {
      steps {
        dir("${TEST_DIR}") {
          sh 'npm install'
        }
      }
    }
    
    stage('Run Tests') {
      steps {
        dir("${TEST_DIR}") {
          sh "node nightwatch.js -c ${params.NIGHTWATCH_CONFIG} --browser ${params.BROWSER} --tags \"@${params.TAGS}\""
        }
      }
    }
    
    stage('Generate Report') {
      steps {
        dir("${TEST_DIR}") {
          sh 'node generate-report.js'
        }
        archiveArtifacts artifacts: 'reports/cucumber_report.html', allowEmptyArchive: true
      }
    }
  }
  
  post {
    failure {
      // On failure, run repairAndReexecution.js from the test-automation parent folder.
      dir("${TEST_DIR}") {
        sh 'node ./repairAndReexecution.js'
      }
      emailext(
        subject: "FAILURE: Build #${env.BUILD_NUMBER} - ${env.JOB_NAME}",
        body: """
          <html>
            <body>
              <h2>Build or Test Failed</h2>
              <p><strong>Job:</strong> ${env.JOB_NAME}</p>
              <p><strong>Build Number:</strong> ${env.BUILD_NUMBER}</p>
              <p><strong>Build URL:</strong> <a href="${env.BUILD_URL}">${env.BUILD_URL}</a></p>
              <p>Please check the console output and repair execution logs for details.</p>
            </body>
          </html>
        """,
        to: "${RECIPIENT_EMAIL}"
      )
    }
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
              <p>All tests passed successfully.</p>
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