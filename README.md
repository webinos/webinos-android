# webinos-android

The webinos platform for Android, including an imported PZP and WRT, based on Anode.


## Release notes

webinos v0.9.0 for Android for test.

It supports Android 3.x and higher.


## webinos dependencies

* webinos-pzp
* webinos-widget

<br>

## Build webinos-android from source

webinos-android is an Android application project with npm package management. Our recommended build environment is 32-bit Ubuntu 12.04 or above. If you are using 64-bit Ubuntu, please run the following command:

    sudo apt-get install ia32-libs

Other Linux distributions or emulated Linux environments are not fully tested but should work, maybe with some twistings. 


### Prerequisites

    * Node.js
    * node-gyp
    * Git
    * Ant
    * JDK
    * G++
    * libgnome-keyring-dev
    * libssl-dev
    * Android SDK


#### Install Node

We have tested building webinos-android with Node v0.8.x. 'apt-get install nodejs' might not give you the wanted Node version, so instead please download a v0.8.x release from here:

http://nodejs.org/dist/

Then do a global install manually.


#### Install node-gyp

    sudo npm install -g node-gyp


#### Install Git

    sudo apt-get install git


#### Install Ant

    sudo apt-get install ant


#### Install JDK

    sudo apt-get install openjdk-7-jdk


#### Install G++

    sudo apt-get install g++


#### Install libgnome-keyring-dev

    sudo apt-get install libgnome-keyring-dev


#### Install libssl-dev

    sudo apt-get install libssl-dev


#### Install Android SDK

Download Android SDK from 

http://developer.android.com/sdk/index.html

Install API Level 11.

Then set the environment variable

    export ANDROID_HOME=/path/to/your/Android/SDK


### Get webinos-android source code

You can get the source code from GitHub.

    git clone https://github.com/webinos/webinos-android


### Build webinos-android with Ant

To build a debug installer, execute

    cd webinos-android
    ant clean debug

If successful the target is generated as

bin/webinos-android-debug.apk


### Build webinos-android with ADT Eclipse

We support ADT Version 22.0.x.

1. Import the project into Eclipse
  
  1) In the "File" menu, "New" -> "Project..." to open the "New Project" window.
  
  2) Expand "Android", select "Android Project from Existing Code", and click "Next>".
  
  3) Click "Browse..." button, in the pop-up window select your webinos-android folder, click "OK".
  
  4) In the "Import Projects" window, make sure in the "Project to Import" box only webinos-android is checked, then click "Finish".

2. Get project dependencies (can be skipped if you have already run command line Ant build)
  
  1) In the "Run" menu select "External tools" -> "External Tools Configurations..."
  
  2) In the "External Tools Configurations" window, expand "Ant Build", you will see the configuration named *configuration_ant*.
  
  3) Select the configuration and click "Run". In the "Console" View window you should see the project webinos-android successfully built.

3. Build and run
  
  1) To make sure the dependencies are included, right-click the wbinos-android project, in the pop-up menu click "Refresh".
  
  2) Make sure your Android device or emulator is connected. 
  
  3) In the "Run" menu, select "Run Configurations...".
  
  4) In the "Run Configurations" window, expand "Android Application", you will see the configration named "webinos-android".
  
  5) Select the configuration and click "Run".
  
If successful the installer is created as

bin/webinos-android.apk


