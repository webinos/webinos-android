#!/usr/bin/env bash
cd node_modules/webinos-pzp
if [ $? -eq 0 ]
then
    npm install git://github.com/webinos/webinos-api-file.git --save
    npm install git://github.com/webinos/webinos-api-deviceStatus.git --save
    npm install git://github.com/webinos/webinos-api-deviceDiscovery.git --save
    npm install git://github.com/webinos/webinos-api-deviceOrientation.git --save
    npm install git://github.com/webinos/webinos-api-events.git --save
    npm install git://github.com/webinos/webinos-api-app2app.git --save
    npm install git://github.com/webinos/webinos-api-geolocation.git --save
    npm install git://github.com/webinos/webinos-api-file.git --save
    npm install git://github.com/webinos/webinos-api-contacts.git --save
    npm install git://github.com/webinos/webinos-api-sensors.git --save
    npm install git://github.com/webinos/webinos-api-media.git --save
    npm install git://github.com/webinos/webinos-api-nfc.git --save
fi
