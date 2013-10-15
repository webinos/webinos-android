/* Used by Ant build script task under project root directory */

importClass(java.io.FileReader);
importClass(java.util.Properties);

function getWrtHome() {
    var props = new Properties();
    try {
        props.load(new FileReader(basedir + "/assets/config/wrt.properties"));
    } catch (e) {
        print("assets/config/wrt.properties not loaded!");
    }
    return props.getProperty("wrt.home");
}

project.setProperty("wrtHome", getWrtHome());
