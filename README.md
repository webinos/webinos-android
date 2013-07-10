# webinos-android

The webinos platform for Android, including PZP and WRT, based on Anode.


## Release notes

webinos v0.9.0 for Android for test.


## webinos dependencies

* webinos-pzp
* webinos-widget

<br>

## Build webinos-android from source

Our recommended build environment is 32-bit Ubuntu 12.04 or above. If you are using 64-bit Ubuntu, please run the following command:

    sudo apt-get install ia32-libs

Other Unix-like systems or emulated Unix-like environments are not fully tested but should work fine, maybe with some twistings. 


### Prerequisites

    * Node
    * Node-gyp
    * Git
    * Ant
    * JDK
    * G++
    * libgnome-keyring-dev
    * libssl-dev
    * Android SDK
    * Anode


#### Install Node

We have tested building webinos-android with Node v0.8.x. 'apt-get install nodejs' might not give you the wanted Node release, so instead please download a v0.8.x release from here:

http://nodejs.org/dist/

Then do a gloabl install manually.


#### Install Node-gyp globally

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

Install API Level 10.

Then set the environment variable

    export ANDROID_HOME=/path/to/your/Android/SDK


#### Get Anode source code

In a seperate folder put latest Anode source code.

    git clone https://github.com/paddybyers/anode

Then set the environment variable

    export ANODE_ROOT=/path/to/your/Anode


### Get webinos-android source code

If you are reading this file, you may already have got the webinos-android source code or, this file is shown on some web page. You can get the source code from GitHub.

    git clone https://github.com/webinos/webinos-android


### Build webinos-android

webinos-android is structured as a 2-level package: Npm level and Android project level. To build the apk, go to the top level webinos-android

    cd webinos-android
    
Then execute

    npm install
    ant

If successful the default debug target is generated as

webinos-android/bin/webinos-debug.apk


