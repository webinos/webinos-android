/*******************************************************************************
*  Code contributed to the webinos project
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*
* Copyright 2011-2012 Paddy Byers
*
******************************************************************************/

package org.webinos.app.wrt.provider;

import java.io.File;
import java.io.FileNotFoundException;
import java.net.URI;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import org.webinos.app.wrt.mgr.WidgetConfig;
import org.webinos.app.wrt.mgr.WidgetManagerService;

import android.util.Log;

public class WidgetContentProvider extends ContentProvider {
	
	private static final String FILE_BASE_URI = "file:///data/data/org.webinos.app/wrt";

	@Override
	public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
		URI uri1 = URI.create(FILE_BASE_URI + uri.getPath());
		File file = new File(uri1.getPath());
		ParcelFileDescriptor parcel = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
		return parcel;
	}

	@Override
	public boolean onCreate() {
		return true;
	}

	@Override
	public int delete(Uri uri, String s, String[] as) {
		throw new UnsupportedOperationException("Not supported by this provider");
	}

	@Override 
	public String getType(Uri uri) {
	    Log.v("WidgetContentProvider", "getType uri" + uri);
	    
	    String[] segments = uri.getPath().split("/");
	    String installId = segments[1];
	    Log.v("WidgetContentProvider", installId);
        WidgetConfig widgetConfig = WidgetManagerService.getWidgetManagerInstance().getWidgetConfig(installId);

        if(widgetConfig == null) {
            Log.e("WidgetContentProvider", "widgetConfig is null - widget not properly installed");
        }
        if(widgetConfig.startFile != null)
        {    
            Log.d("WidgetContentProvider MIME type:", widgetConfig.startFile.contentType);
            return widgetConfig.startFile.contentType;
        }  
        else
            throw new UnsupportedOperationException("wigetConfig.startFile is empty");
	}

	@Override
	public Uri insert(Uri uri, ContentValues contentvalues) {
		throw new UnsupportedOperationException("Not supported by this provider");
	}

	@Override
	public Cursor query(Uri uri, String[] as, String s, String[] as1, String s1) {
		throw new UnsupportedOperationException("Not supported by this provider");
	}

	@Override
	public int update(Uri uri, ContentValues contentvalues, String s, String[] as) {
		throw new UnsupportedOperationException("Not supported by this provider");
	}

}
