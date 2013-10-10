/* Used by Ant build exec task under project root directory */

var packageJsonFile = "../../node_modules/webinos-pzp/node_modules/webinos-utilities/package.json";
var packageJsonObj = require(packageJsonFile);
packageJsonObj["dependencies"]["webinos-api-test"] = "get42@0.0.1";
require("fs").writeFileSync(packageJsonFile, JSON.stringify(packageJsonObj));
