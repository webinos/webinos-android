# webinos-android

The webinos platform for Android, including PZP and WRT, based on Anode.


## Release notes

webinos v0.95 for Android for test.


## Dependcy modules

* webinos-pzp
* webinos-widget


## Temporary build instructions

These instructions can be used before the modules webinos-pzp and webinos-widget change accordingly.

    1) git clone https://github.com/webinos/webinos-android.git
    2) cd webinos-android
    3) npm install
    4) patch -p2 < tmp/module-pzp-widget.patch 
    5) npm install
    6) ant clean; ant
