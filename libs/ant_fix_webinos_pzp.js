/* Used by Ant build exec task under project root directory */

var package_json_object = require("../node_modules/webinos-pzp/node_modules/webinos-utilities/package.json");
package_json_object["dependencies"]["webinos-api-test"] = "get42@0.0.1";
require("fs").writeFile("node_modules/webinos-pzp/node_modules/webinos-utilities/package.json", JSON.stringify(package_json_object));
