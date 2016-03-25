#!/usr/bin/env node --harmony

var fs           = require('fs');
var open         = require('open');
var package      = require('./package.json');
var path         = require('path');
var program      = require('commander');
var readlineSync = require('readline-sync');

var APP_HUB_ID;
var APP_HUB_SECRET;
var BUILD_FILE_NAME = 'AppHubBuild_' + Date.now() + '.zip';
var BUILD_FILE_PATH = path.resolve('./', BUILD_FILE_NAME);
var BUILD_URL_BASE  = 'https://dashboard.apphub.io/projects/';
var BUILD_URL;

program
  .version(package.version)
  .option('-c, --configure', '(Re)Configure AppHub ID and Secret key')
  .option('-o, --open-build-url', 'Open AppHub Builds URL after a successful build and deploy.')
  .parse(process.argv);

if (program.configure) {
  setup();
}
else {
  readPreviouslySavedAppHubCredentials();
}

var BUILD_URL = BUILD_URL_BASE + APP_HUB_ID;

build();

deploy();

if (program.openBuildUrl)
  openBuildUrl();

process.exit(0);

// Private Functions


function setup() {
  APP_HUB_ID     = readlineSync.question('AppHub App ID: ');
  APP_HUB_SECRET = readlineSync.question('AppHub App Secret: ');

  console.log('');

  var appHubCredentialsAsJSON = JSON.stringify( { "appHubId": APP_HUB_ID, "appHubSecret": APP_HUB_SECRET } );

  try {
    fs.writeFileSync( './.apphub', appHubCredentialsAsJSON, { mode: 0600 } );
  }
  catch (error) {
    console.log('There was an error saving your AppHub config to file.');
    console.log(error.message);
    process.exit(1);
  }

  console.log('AppHub configuration saved to .apphub for future deploys.');
  console.log('');
};

function readPreviouslySavedAppHubCredentials() {
  // If run without any .apphub file then run setup.
  var appHubData;
  try {
    var appHubFileData = fs.readFileSync( './.apphub' );
    appHubData = JSON.parse(appHubFileData);

    // If .apphub exists, try and get values.
    if (!appHubData.appHubId.trim() || !appHubData.appHubSecret.trim())
      throw new Error('One or both of your AppHub credentials are blank');

    // .apphub file exists, can be read and the credentials are reasonable (i.e. present and not blank).
    console.log('.apphub file exists! Reading credentials.');

    APP_HUB_ID     = appHubData.appHubId;
    APP_HUB_SECRET = appHubData.appHubSecret;
  }
  catch (error) {
    if (error.code == 'ENOENT') {
      // If missing file, no problem, we'll kick off the Setup function to create it.
      setup();
    }
    else {
      console.log('The contents of .apphub file were not what we were expecting. Try running with --configure command to re-enter your AppHub credentials.');
      console.log('');
      process.exit(1);
    }
  }
};


function build() {
  console.log('Building...');

  buildResult = require('child_process').execSync( './node_modules/.bin/apphub build --verbose -o ' + BUILD_FILE_NAME ).toString();

  console.log(buildResult);
  console.log('');
  console.log('BUILD SUCCESSFUL!');
  console.log('');
};

function deploy() {
  console.log('Deploying...');
  console.log('');

  try {
    getUrlForPutCommand =  'curl -X GET';
    getUrlForPutCommand += ' -H "X-AppHub-Application-ID: ' + APP_HUB_ID + '"';
    getUrlForPutCommand += ' -H "X-AppHub-Application-Secret: ' + APP_HUB_SECRET + '"';
    getUrlForPutCommand += ' -H "Content-Type: application/zip"';
    getUrlForPutCommand += ' -L https://api.apphub.io/v1/upload';
    getUrlForPutCommand += ' | python -c \'import json,sys;obj=json.load(sys.stdin);print obj["data"]["s3_url"]\'';

    urlForPut = require('child_process').execSync( getUrlForPutCommand ).toString().trim();

    console.log('urlForPut:');
    console.log(urlForPut);

    putCommand  = 'curl -X PUT';
    putCommand += ' -H "Content-Type: application/zip"';
    putCommand += ' -L "' + urlForPut + '"';
    putCommand += ' --upload-file ' + BUILD_FILE_NAME;

    console.log('putCommand:');
    console.log(putCommand);

    putResponse = require('child_process').execSync( putCommand ).toString().trim();

    console.log( putResponse );
    console.log('');
    console.log("DEPLOY SUCCESSFUL!");
  }
  catch(error) {
    console.log('');
    console.log('There was a problem uploading the build:');
    console.log(error);

    process.exit(1);
  }

  try {
    console.log('');
    console.log('Removing Build File...');
    console.log('');


    console.log('BUILD_FILE_PATH: ')
    console.log(BUILD_FILE_PATH);

    fs.unlinkSync(BUILD_FILE_PATH)

    console.log('BUILD FILE REMOVED!');
    console.log('');



  }
  catch(error) {
    console.log('');
    console.log('There was a problem removing the build file: ' + BUILD_FILE_PATH);
    console.log('');
    console.log(error);

    process.exit(1);
  }

  console.log('');
  console.log('SUCCESSFULLY BUILT AND DEPLOYED TO APPHUB!')
  console.log('');

  console.log('You can see your build here: ' + BUILD_URL);
  console.log('');

};

function openBuildUrl() {
  console.log('Opening AppHub Builds in your browser...');

  open(BUILD_URL);
};