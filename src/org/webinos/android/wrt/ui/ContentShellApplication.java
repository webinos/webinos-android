// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.webinos.android.wrt.ui;

import android.app.Application;
import android.content.Context;

import org.chromium.base.PathUtils;
import org.chromium.content.app.LibraryLoader;
import org.chromium.content.browser.ResourceExtractor;

/**
 * Entry point for the content shell application.  Handles initialization of information that needs
 * to be shared across the main activity and the child services created.
 */
public class ContentShellApplication extends Application {

    private static final String[] MANDATORY_PAK_FILES = new String[] {"content_shell.pak"};
    private static final String PRIVATE_DATA_DIRECTORY_SUFFIX = "content_shell";
    private static Context context;

    @Override
    public void onCreate() {
        super.onCreate();
        initializeApplicationParameters();
        ContentShellApplication.context = getApplicationContext();
    }

    public static void initializeApplicationParameters() {
        ResourceExtractor.setMandatoryPaksToExtract(MANDATORY_PAK_FILES);
        PathUtils.setPrivateDataDirectorySuffix(PRIVATE_DATA_DIRECTORY_SUFFIX);
    }

    public static Context getAppContext() {
        return ContentShellApplication.context;
    }

}
