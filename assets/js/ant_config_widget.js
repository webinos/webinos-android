/* Used by Ant build exec task under project root directory */

if(process.argv.length !== 3) process.exit(1);

var fs = require("fs");
var interfaceFile = "../../node_modules/webinos-widget/platform_interfaces.json";

if(!fs.existsSync(interfaceFile)) {
    fs.writeFileSync(interfaceFile, '{"android": {"wrt_home": ""}}');
}

var packageJsonObj = require(interfaceFile);

if(packageJsonObj["android"] === undefined) {
    packageJsonObj.android = {"wrt_home": ""};
}
packageJsonObj["android"]["wrt_home"] = process.argv[2];
fs.writeFileSync(interfaceFile, JSON.stringify(packageJsonObj, null, 2));
