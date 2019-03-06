import groovy.json.JsonOutput

def APP_NAME = 'range-myra-api'
def BUILD_CONFIG = APP_NAME
def IMAGESTREAM_NAME = APP_NAME
def TAG_NAMES = ['dev', 'test', 'prod']
def PIRATE_ICO = 'http://icons.iconarchive.com/icons/aha-soft/torrent/64/pirate-icon.png'
def JENKINS_ICO = 'https://wiki.jenkins-ci.org/download/attachments/2916393/logo.png'
def OPENSHIFT_ICO = 'https://commons.wikimedia.org/wiki/File:OpenShift-LogoType.svg'
def SCHEMA_SPY_IMAGSTREAM_NAME = 'schema-spy'
def PROJECT_NAMESPACE_BASE = 'range-myra-'
def POD_LABEL = "${APP_NAME}-${UUID.randomUUID().toString()}"

//  jenkins-slave-python3nod
def notifySlack(text, channel, url, attachments, icon) {
    def slackURL = url
    def jenkinsIcon = icon
    def payload = JsonOutput.toJson([text: text,
        channel: channel,
        username: "Jenkins",
        icon_url: jenkinsIcon,
        attachments: attachments
    ])
    sh "curl -s -S -X POST --data-urlencode \'payload=${payload}\' ${slackURL}"
}

// See https://github.com/jenkinsci/kubernetes-plugin
podTemplate(label: "${POD_LABEL}", name: "${POD_LABEL}", serviceAccount: 'jenkins', cloud: 'openshift', containers: [
  containerTemplate(
    name: 'jnlp',
    image: 'docker-registry.default.svc:5000/openshift/jenkins-slave-nodejs:8',
    resourceRequestCpu: '1500m',
    resourceLimitCpu: '2000m',
    resourceRequestMemory: '1Gi',
    resourceLimitMemory: '2Gi',
    workingDir: '/tmp',
    command: '',
    args: '${computer.jnlpmac} ${computer.name}',
    alwaysPullImage: false
    // envVars: [
    //     secretEnvVar(key: 'BDD_DEVICE_FARM_USER', secretName: 'bdd-credentials', secretKey: 'username'),
    //     secretEnvVar(key: 'BDD_DEVICE_FARM_PASSWD', secretName: 'bdd-credentials', secretKey: 'password'),
    //     secretEnvVar(key: 'ANDROID_DECRYPT_KEY', secretName: 'android-decrypt-key', secretKey: 'decryptKey')
    //   ]
  )
]) {
  node("${POD_LABEL}") {
    stage('Checkout') {
      echo "Checking out source"
      checkout scm

      GIT_COMMIT_SHORT_HASH = sh (
        script: """git describe --always""",
        returnStdout: true).trim()
      GIT_COMMIT_AUTHOR = sh (
        script: """git show -s --pretty=%an""",
        returnStdout: true).trim()
      GIT_BRANCH_NAME = sh (
        script: """git branch -a -v --no-abbrev --contains ${GIT_COMMIT_SHORT_HASH} | \
        grep 'remotes' | \
        awk -F ' ' '{print \$1}' | \
        awk -F '/' '{print \$3}'""",
        returnStdout: true).trim()
      SLACK_TOKEN = sh (
        script: """oc get secret/slack -o template --template="{{.data.token}}" | base64 --decode""",
        returnStdout: true).trim()
    }
    
    stage('Setup') {
      echo "Setup: ${BUILD_ID}"
      sh "node -v"
      sh "npm -v"
  
      sh "npm ci"
    }

    stage('Test') {
      echo "Testing: ${BUILD_ID}"

      script {
        //
        // Check the code builds
        //

        try {
          echo "Checking Build"
          sh "npm run build"
        } catch (error) {
          def attachment = [:]
          attachment.fallback = 'See build log for more details'
          attachment.title = "API Build ${BUILD_ID} FAILED! :face_with_head_bandage: :hankey:"
          attachment.color = '#CD0000' // Red
          attachment.text = "The code does not build.\ncommit ${GIT_COMMIT_SHORT_HASH} by ${GIT_COMMIT_AUTHOR}"
          // attachment.title_link = "${env.BUILD_URL}"

          notifySlack("${APP_NAME}, Build #${BUILD_ID}", "#rangedevteam", "https://hooks.slack.com/services/${SLACK_TOKEN}", [attachment], JENKINS_ICO)
          sh "exit 1001"
        }

        //
        // Run our code quality tests
        //

        try {
          echo "Checking code quality with SonarQube"
          SONARQUBE_URL = sh (
              script: 'oc get routes -o wide --no-headers | awk \'/sonarqube/{ print match($0,/edge/) ?  "https://"$2 : "http://"$2 }\'',
              returnStdout: true
                ).trim()
          echo "SONARQUBE_URL: ${SONARQUBE_URL}"
          dir('sonar-runner') {
            sh returnStdout: true, script: "./gradlew sonarqube -Dsonar.host.url=${SONARQUBE_URL} -Dsonar.verbose=true --stacktrace --info -Dsonar.branch=${GIT_BRANCH_NAME}"
          }
        } catch (error) {
          def attachment = [:]
          attachment.fallback = 'See build log for more details'
          attachment.title = "API Build ${BUILD_ID} WARNING! :unamused: :zany_face: :fox4:"
          attachment.color = '#FFA500' // Orange
          attachment.text = "The SonarQube code quality check failed.\ncommit ${GIT_COMMIT_SHORT_HASH} by ${GIT_COMMIT_AUTHOR}"
          // attachment.title_link = "${env.BUILD_URL}"

          notifySlack("${APP_NAME}, Build #${BUILD_ID}", "#rangedevteam", "https://hooks.slack.com/services/${SLACK_TOKEN}", [attachment], JENKINS_ICO)
        }

        //
        // Check code quality with a LINTer
        //

        try {
          echo "Checking code quality with LINTer"
          sh "npm run test:lint"
        } catch (error) {
          def attachment = [:]
          attachment.fallback = 'See build log for more details'
          attachment.title = "API Build ${BUILD_ID} WARNING! :unamused: :zany_face: :fox4:"
          attachment.color = '#FFA500' // Orange
          attachment.text = "There LINTer code quality check failed.\ncommit ${GIT_COMMIT_SHORT_HASH} by ${GIT_COMMIT_AUTHOR}"
          // attachment.title_link = "${env.BUILD_URL}"

          notifySlack("${APP_NAME}, Build #${BUILD_ID}", "#rangedevteam", "https://hooks.slack.com/services/${SLACK_TOKEN}", [attachment], JENKINS_ICO)
        }

        //
        // Run our unit tests et al.
        //

        try {
          echo "Running Unit Tests"
          sh "npm test"
        } catch (error) {
          def attachment = [:]
          attachment.fallback = 'See build log for more details'
          attachment.title = "API Build ${BUILD_ID} FAILED! :face_with_head_bandage: :hankey:"
          attachment.color = '#CD0000' // Red
          attachment.text = "There are issues with the unit tests.\ncommit ${GIT_COMMIT_SHORT_HASH} by ${GIT_COMMIT_AUTHOR}"
          // attachment.title_link = "${env.BUILD_URL}"

          notifySlack("${APP_NAME}, Build #${BUILD_ID}", "#rangedevteam", "https://hooks.slack.com/services/${SLACK_TOKEN}", [attachment], JENKINS_ICO)
          sh "exit 1001"
        }
      }
    }

    stage('Image Build') {
      echo "Build: ${BUILD_ID}"

      // run the oc build to package the artifacts into a docker image
      openshiftBuild bldCfg: APP_NAME, showBuildLogs: 'true', verbose: 'false'

      // Don't tag with BUILD_ID so the pruner can do it's job; it won't delete tagged images.
      // Tag the images for deployment based on the image's hash
      IMAGE_HASH = sh (
        script: """oc get istag ${IMAGESTREAM_NAME}:latest -o template --template=\"{{.image.dockerImageReference}}\"|awk -F \":\" \'{print \$3}\'""",
        returnStdout: true).trim()
      echo ">> IMAGE_HASH: ${IMAGE_HASH}"

      openshiftTag destStream: IMAGESTREAM_NAME, verbose: 'true', destTag: TAG_NAMES[0], srcStream: IMAGESTREAM_NAME, srcTag: "${IMAGE_HASH}"
    
      try {
        // Sale Schema Spy down and up will cause it to rebuild the schema documentation. This isn't the most
        // efficiant way to do this but at least its automated.

        // For this to work the Jenkins service mush have edit permissions within the deployment project.
        // Example OC cmd to accomplish this task (it's better if you have project init scripts that do this);
        // oc policy add-role-to-user edit system:serviceaccount:range-myra-tools:jenkins -n range-myra-dev
        
        echo "Scaling Schema Spy to trigger refresh"

        openshiftScale deploymentConfig: SCHEMA_SPY_IMAGSTREAM_NAME, replicaCount: 0, namespace: PROJECT_NAMESPACE_BASE + TAG_NAMES[0]
        openshiftScale deploymentConfig: SCHEMA_SPY_IMAGSTREAM_NAME, replicaCount: 1, namespace: PROJECT_NAMESPACE_BASE + TAG_NAMES[0]
      } catch (error) {
        echo "Unable to scale schema spy"
      }
      
      try {
        def attachment = [:]
        attachment.title = "API Build ${BUILD_ID} OK! :heart: :tada:"
        attachment.fallback = 'See build log for more details'
        attachment.text = "Another huge sucess for the Range Team.\nA freshly minted build is being deployed and will be available shortly.\ncommit ${GIT_COMMIT_SHORT_HASH} by ${GIT_COMMIT_AUTHOR}"
        attachment.color = '#00FF00' // Lime Green

        notifySlack("${APP_NAME}", "#rangedevteam", "https://hooks.slack.com/services/${SLACK_TOKEN}", [attachment], JENKINS_ICO)
      } catch (error) {
        echo "Unable send update to slack, error = ${error}"
      }
    }
  }

  node ('master') {
    stage('Approval') {
      timeout(time: 4, unit: 'HOURS') {
        input message: "Deploy to test?", submitter: 'authenticated'
      }
      stage('Promotion') {
        openshiftTag destStream: IMAGESTREAM_NAME, verbose: 'true', destTag: TAG_NAMES[1], srcStream: IMAGESTREAM_NAME, srcTag: "${IMAGE_HASH}"
        notifySlack("Promotion Completed\n Build #${BUILD_ID} was promoted to test.", "#range-api", "https://hooks.slack.com/services/${SLACK_TOKEN}", [], OPENSHIFT_ICO)
      }
    }
  }
}