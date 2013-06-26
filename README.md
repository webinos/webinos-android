# webinos-pzp-android

The webinos platform for Android, including PZP and WRT, based on Anode.

## Building webinos for Android from source code

You should have a development host running Linux or Mac, and a target Android device connected to the host via a USB cable, normally. These instructions work on Android development host running Mac or Linux. Provided you're not building the native parts, then Windows/cygwin should also work. Building the native parts on Windows is not fully working yet.

You should have installed latest Android SDK on the development host. You need to install the Android Level 10 API platform.

Install a recent version of Python 2.x.

### Get webinos PZP android on the development host

git clone git@github.com:username/webinos-pzp-android.git

### Get Anode on the development host

The webinos runtime for Android is based on the Anode project, which includes a port of Node.js to the Android platform, and a framework for building Node.js modules in Java.

The native parts - which include Node.js itself, plus a small number of natively implemented modules - are pre-built in the webinos tree. This means that you can build only the Java parts to generate the webinos packages, and you do not need to assemble the Android native toolchain.

If you want to build the native components as well, head over to the Anode Build instructions, and also see the instructions for authoring and building native addons.

cd <your Anode dir>
git clone git://github.com/paddybyers/anode.git
Environment variables
You need to set up the ANDROID_HOME environment variable as described in the Android SDK documentation

export ANDROID_HOME=/path/to/your/Android/SDK
Then the ANODE_ROOT variable needs to be set up to point to the working copy of the anode repo. If it is cloned directly into <work dir> then you can do:

export ANODE_ROOT=<your Anode dir>/anode
Build the Android packages on the development host
cd to the location of top-level build file for the Android packages:

cd webinos-pzp-android

Then build:

npm install

ant
This builds a debug version of the runtime. You can also build a release target:

ant release

### Install webinos on the target Android devcie

Three apks are generated during build. installer-debug.apk is a combination of app-debug.apk and wrt-debug.apk. You can install Webinos android PZP by doing either

adb install installer/bin/WebinosInstaller-debug.apk

or 

adb install app/bin/app-debug.apk
adb install wrt/bin/wrt-debug.apk

