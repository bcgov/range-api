import groovy.json.JsonOutput

def APP_NAME = 'range-myra-api'
def BUILD_CONFIG = APP_NAME
def IMAGESTREAM_NAME = APP_NAME
def TAG_NAMES = ['dev', 'test', 'prod']
def CMD_PREFIX = 'PATH=$PWD/node-v8.11.1-linux-x64/bin:$PATH'
def NODE_URI = 'https://nodejs.org/dist/latest-v8.x/node-v8.11.1-linux-x64.tar.xz'
def PIRATE_ICO = 'http://icons.iconarchive.com/icons/aha-soft/torrent/64/pirate-icon.png'
def JENKINS_ICO = 'https://wiki.jenkins-ci.org/download/attachments/2916393/logo.png'
def OPENSHIFT_ICO = 'https://commons.wikimedia.org/wiki/File:OpenShift-LogoType.svg'
def SCHEMA_SPY_IMAGSTREAM_NAME = 'schema-spy'
def PROJECT_NAMESPACE_BASE = 'range-myra-'

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
podTemplate(label: 'range-api-node-build', name: 'range-api-node-build', serviceAccount: 'jenkins', cloud: 'openshift', containers: [
  containerTemplate(
    name: 'jnlp',
    image: '172.50.0.2:5000/openshift/jenkins-slave-python3nodejs:latest',
    resourceRequestCpu: '1500m',
    resourceLimitCpu: '2000m',
    resourceRequestMemory: '2Gi',
    resourceLimitMemory: '4Gi',
    workingDir: '/tmp',
    command: '',
    args: '${computer.jnlpmac} ${computer.name}',
    alwaysPullImage: true
    // envVars: [
    //     secretEnvVar(key: 'BDD_DEVICE_FARM_USER', secretName: 'bdd-credentials', secretKey: 'username'),
    //     secretEnvVar(key: 'BDD_DEVICE_FARM_PASSWD', secretName: 'bdd-credentials', secretKey: 'password'),
    //     secretEnvVar(key: 'ANDROID_DECRYPT_KEY', secretName: 'android-decrypt-key', secretKey: 'decryptKey')
    //   ]
  )
]) {
  node('range-api-node-build') {
    stage('Checkout') {
      echo "Checking out source"
      checkout scm

    GIT_COMMIT_SHORT_HASH = sh (
      script: """git describe --always""",
      returnStdout: true).trim()
    GIT_COMMIT_AUTHOR = sh (
      script: """git show -s --pretty=%an""",
      returnStdout: true).trim()
    }
    
    stage('Install') {
      echo "Setup: ${BUILD_ID}"
      
      // The version of node in the `node` that comes with OpenShift is too old
      // so I use a generic Linux and install my own node from LTS.
      sh "curl ${NODE_URI} | tar -Jx"
      sh "${CMD_PREFIX} npm i npm@latest"
      sh "rm -rf ./node-v8.11.1-linux-x64/lib/node_modules/npm"
      sh "cp -a ./node_modules/npm ./node-v8.11.1-linux-x64/lib/node_modules/"
      sh "${CMD_PREFIX} node -v"
      sh "${CMD_PREFIX} npm -v"
      // setup the node dev environment
      sh "${CMD_PREFIX} npm ci"
      // not sure if this needs to be added to package.json.
      sh "${CMD_PREFIX} npm i escape-string-regexp"
    }
    
    stage('Test') {
      echo "Testing: ${BUILD_ID}"
      // Run a security check on our packages
      // sh "${CMD_PREFIX} npm run test:security"
      // Run our unit tests et al.
      script {
        // Run a security check on our packages
        try {
          sh "${CMD_PREFIX} ./node_modules/.bin/nsp check"
        } catch (error) {
          // def output = readFile('nsp-report.txt').trim()
          def attachment = [:]
          attachment.fallback = 'See build log for more details'
          attachment.title = "API Build ${BUILD_ID} WARNING! :unamused: :zany_face: :fox4:"
          attachment.color = '#FFA500' // Orange
          attachment.text = "There are security warnings related to your packages.\ncommit ${GIT_COMMIT_SHORT_HASH} by ${GIT_COMMIT_AUTHOR}"

          // Temporarily disabled until hoek is fixed. jl.
          notifySlack("${APP_NAME}, Build #${BUILD_ID}", "#rangedevteam", "https://hooks.slack.com/services/${SLACK_TOKEN}", [attachment], PIRATE_ICO)
        }

        try {
          // Run our unit tests et al.
          sh "${CMD_PREFIX} npm run test:lint"
        } catch (error) {
          def attachment = [:]
          attachment.fallback = 'See build log for more details'
          attachment.title = "API Build ${BUILD_ID} WARNING! :unamused: :zany_face: :fox4:"
          attachment.color = '#FFA500' // Orange
          attachment.text = "There are issues with the code quality.\ncommit ${GIT_COMMIT_SHORT_HASH} by ${GIT_COMMIT_AUTHOR}"
          // attachment.title_link = "${env.BUILD_URL}"

          notifySlack("${APP_NAME}, Build #${BUILD_ID}", "#rangedevteam", "https://hooks.slack.com/services/${SLACK_TOKEN}", [attachment], JENKINS_ICO)
        }

        try {
          // Run our unit tests et al.
          sh "${CMD_PREFIX} npm test"
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

    stage('Build') {
      echo "Build: ${BUILD_ID}"
      // run the oc build to package the artifacts into a docker image
      openshiftBuild bldCfg: APP_NAME, showBuildLogs: 'true', verbose: 'true'

      // Don't tag with BUILD_ID so the pruner can do it's job; it won't delete tagged images.
      // Tag the images for deployment based on the image's hash
      IMAGE_HASH = sh (
        script: """oc get istag ${IMAGESTREAM_NAME}:latest -o template --template=\"{{.image.dockerImageReference}}\"|awk -F \":\" \'{print \$3}\'""",
        returnStdout: true).trim()
      echo ">> IMAGE_HASH: ${IMAGE_HASH}"

      openshiftTag destStream: IMAGESTREAM_NAME, verbose: 'true', destTag: TAG_NAMES[0], srcStream: IMAGESTREAM_NAME, srcTag: "${IMAGE_HASH}"
    
      // Sale Schema Spy down and up will cause it to rebuild the schema documentation. This isn't the most
      // efficiant way to do this but at least its automated.
      echo "Scaling Schema Spy to trigger refresh"

      // For this to work the Jenkins service mush have edit permissions within the deployment project.
      // Example OC cmd to accomplish this task (it's better if you have project init scripts that do this);
      // oc policy add-role-to-user edit system:serviceaccount:range-myra-tools:jenkins -n range-myra-dev
      openshiftScale deploymentConfig: SCHEMA_SPY_IMAGSTREAM_NAME, replicaCount: 0, namespace: PROJECT_NAMESPACE_BASE + TAG_NAMES[0]
      openshiftScale deploymentConfig: SCHEMA_SPY_IMAGSTREAM_NAME, replicaCount: 1, namespace: PROJECT_NAMESPACE_BASE + TAG_NAMES[0]
      
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
  stage('Approval') {
    timeout(time: 1, unit: 'DAYS') {
      input message: "Deploy to test?", submitter: 'jleach-admin'
    }
    node ('master') {
      stage('Promotion') {
        openshiftTag destStream: IMAGESTREAM_NAME, verbose: 'true', destTag: TAG_NAMES[1], srcStream: IMAGESTREAM_NAME, srcTag: "${IMAGE_HASH}"
        notifySlack("Promotion Completed\n Build #${BUILD_ID} was promoted to test.", "#range-api", "https://hooks.slack.com/services/${SLACK_TOKEN}", [], OPENSHIFT_ICO)
      }
    }  
  }
}