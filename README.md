# webinos-android

The webinos platform for Android, including an imported PZP and WRT, based on Anode.


## Release notes

webinos v0.9.0 for Android for test.

It supports Android 3.x and above.


## webinos dependencies

* webinos-pzp
* webinos-widget

<br>

## Build webinos-android from source

Our recommended build environment is 32-bit Ubuntu 12.04 or above. If you are using 64-bit Ubuntu, please run the following command:

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


### Build webinos-android

webinos-android is an Android application project with npm package management. To build a debug installer, execute

    cd webinos-android
    ant clean debug

If successful the target is generated as

bin/webinos-debug.apk


