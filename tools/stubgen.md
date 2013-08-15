For webinos-android developers:

If to add new bridged classes, use stubgen.jar to generate .java files:

    cat ../src/stubs | xargs -n1 java -jar stubgen.jar --classpath ../bin/classes/ --out ../src/ --verbose

