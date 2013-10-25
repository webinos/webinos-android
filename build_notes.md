
## Windows build notes

On windows, if you are using Visual Studio 2012, you will have to manually specify the Visual Studio version on node-gyp otherwise you will get an error:
"error MSB8020: The builds tools for Visual Studio 2010 (Platform Toolset = 'v100') cannot be found".
In order to get pass this error, modify the custom_rules.xml file and add the "--msvs_version=2012" argument in the npm command (line 30) by adding the following line:

    <arg line="--msvs_version=2012"/>
    

## WRT update notes

To update to latest Chromium renderer please follow instructions at https://github.com/mlasak/android-content-view

* The resulting ```export.zip``` is to be extracted in ```webinos-android/refs``` 
* copy ```webinos-android/refs/shell_apk/assets/content_shell.pak``` to ```webinos-android/assets```
* copy ```webinos-android/refs/shell_apk/libs/armeabi-v7a``` to ```webinos-android/libs```

Rebuild webinos-android.
