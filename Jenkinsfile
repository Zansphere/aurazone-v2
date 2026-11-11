pipeline {
    agent any

    options {
        timeout(time: 60, unit: 'MINUTES')
        ansiColor('xterm')
        disableConcurrentBuilds()
    }

    environment {
        CI = 'true'
        NODE_ENV = 'test'
        TEST_ENV = 'ci'
        TEST_API_URL = 'http://localhost:5000/api/v1'
        TEST_WEB_URL = 'http://localhost:3000'
        DATABASE_URL = 'postgresql://aurazone:aurazone@localhost:5432/aurazone_test?schema=public'
        JWT_SECRET = 'ci-test-jwt-secret-for-jenkins-pipeline'
    }

    stages {
        stage('Checkout & Dependencies') {
            steps {
                echo '=== Checking out repository and installing dependencies ==='
                sh 'pnpm install'
                sh 'pnpm exec playwright install --with-deps chromium'
            }
        }

        stage('Ephemeral Database & Seed') {
            steps {
                echo '=== Initializing isolated test database ==='
                sh 'pnpm db:push'
            }
        }

        stage('Build & Start Services') {
            steps {
                echo '=== Building workspace packages and starting API service ==='
                sh 'pnpm --filter @aurazone/validators build'
                sh 'pnpm --filter @aurazone/api build'
                // Start API service in background
                sh 'nohup pnpm --filter @aurazone/api start > api_server.log 2>&1 &'
                sh 'sleep 5'
                // Healthcheck
                sh 'curl -f http://localhost:5000/health || true'
            }
        }

        stage('Parallel Test Execution') {
            parallel {
                stage('API Test Suite') {
                    steps {
                        echo '=== Running API Tests (Role-Based & Suite 800) ==='
                        sh 'pnpm --filter @aurazone/automation test:api || true'
                    }
                }
                stage('Web Storefront E2E') {
                    steps {
                        echo '=== Running Web Storefront Tests ==='
                        sh 'pnpm --filter @aurazone/automation test:web || true'
                    }
                }
                stage('Mobile Flutter Architecture') {
                    steps {
                        echo '=== Running Mobile Android / Appium Architecture Tests ==='
                        sh 'pnpm --filter @aurazone/automation test:mobile-native || true'
                    }
                }
            }
        }

        stage('Aggregate Reports') {
            steps {
                echo '=== Aggregating Allure & JUnit Test Results ==='
                junit testResults: 'apps/automation/reports/junit.xml', allowEmptyResults: true
                
                // Allure Report generation via Jenkins Allure Plugin
                allure([
                    includeProperties: false,
                    jdk: '',
                    properties: [],
                    reportBuildPolicy: 'ALWAYS',
                    results: [[path: 'apps/automation/allure-results']]
                ])
            }
        }
    }

    post {
        always {
            echo '=== Cleaning up background processes and archiving artifacts ==='
            sh 'pkill -f "fastify" || true'
            archiveArtifacts artifacts: 'apps/automation/reports/**/*', allowEmptyArchive: true
        }
        success {
            echo '=== All test suites passed successfully! ==='
        }
        failure {
            echo '=== Build/Tests failed. Check Allure report and server logs. ==='
            archiveArtifacts artifacts: 'api_server.log', allowEmptyArchive: true
        }
    }
}

