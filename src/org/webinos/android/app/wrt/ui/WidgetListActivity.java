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

package org.webinos.android.app.wrt.ui;

import java.io.IOException;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.webinos.android.R;
import org.webinos.android.app.pzp.ConfigActivity;
import org.webinos.android.app.wrt.mgr.WidgetConfig;
import org.webinos.android.app.wrt.mgr.WidgetManagerImpl;
import org.webinos.android.app.wrt.mgr.WidgetManagerService;
import org.webinos.android.util.AssetUtils;

import android.app.ActionBar;
import android.app.Activity;
import android.app.Dialog;
import android.app.ListActivity;
import android.app.ProgressDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Configuration;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.util.Log;
import android.util.Base64;
import android.view.ContextMenu;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.widget.AdapterView.AdapterContextMenuInfo;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

public class WidgetListActivity extends ListActivity
	implements WidgetManagerService.WidgetManagerLaunchListener, WidgetManagerImpl.EventListener {

	private static final String TAG = "WidgetListActivity";
	private static final String STORES_FILE = "config/stores.json";
	private static final String ACTION_PROGRESS = "org.webinos.android.app.wrt.ui.PROGRESS";
	private static final String ACTION_PZP_NOTIFICATION = "org.webinos.pzp.notification.response";
	static final String CONTENTSHELLSTART = "org.webinos.android.wrt.ui.ContentShellActivity";
	static final String ACTION_START = "org.webinos.android.wrt.START";
	static final String ACTION_STOP = "org.webinos.android.wrt.STOP";
	static final String ACTION_STOPALL = "org.webinos.android.wrt.STOPALL";
	static final String CMD = "cmdline";
	static final String INST = "instance";
	static final String ID = "id";
	static final String OPTS = "options";

	private static final int STORES_MENUITEM_BASE = 100;
	static final int SCANNING_DIALOG          = 0;
	static final int NO_WIDGETS_DIALOG        = 1;
	static final int FOUND_WIDGETS_DIALOG     = 2;

	private WidgetManagerImpl mgr;
	private WidgetImportHelper scanner;
	private Handler asyncRefreshHandler;
	private String[] ids;
	private Store[] stores;
	private ProgressDialog progressDialog;
	private int progress;
	private final int PROGRESS_MAX = 10;
	private boolean blocked;
	private boolean useAndroidWebView=false;
	private String pzpWebsocketPort="8080";
	private ProgressBroadcastReceiver progressBroadcastReceiver;

	@Override
	public void onCreate(Bundle bundle) {
		super.onCreate(bundle);
		setContentView(R.layout.activity_widget_list);
		
		ActionBar actionBar = getActionBar();
		if(actionBar != null){
			actionBar.setDisplayShowHomeEnabled(false);
			actionBar.setDisplayShowTitleEnabled(false);
		} else {
			Log.i(TAG, "WidgetListActivity has no action bar.");
		}

		registerForContextMenu(getListView());
		asyncRefreshHandler = new Handler() {
			@Override
			public void handleMessage(Message msg) {
				initList();
			}
		};
		mgr = WidgetManagerService.getWidgetManagerInstance(this, this);
		if(mgr != null) {
			mgr.addEventListener(this);
			initList();
		}

		scanner = new WidgetImportHelper(this);

		/* populate stores array */
		stores = getStores();

		synchronized(this) {
			if(mgr == null) {
				blocked = true;
				runOnUiThread(new Runnable() {
					@Override
					public void run() {
						/* put up progress dialog until the service is
						 * available */
						Activity context = WidgetListActivity.this;
						progressDialog = new ProgressDialog(context);
						progressDialog.setCancelable(false);
						progressDialog.setMessage(context.getString(R.string.initialising_runtime));
						progressDialog.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);
						progressDialog.setIndeterminate(false);
						progressDialog.setMax(PROGRESS_MAX);
						progressDialog.show();
						progressDialog.setProgressNumberFormat(null);
					}
				});
			}
		}

		/* BroadcastReceiver to receive module loading progress */
		progressBroadcastReceiver = new ProgressBroadcastReceiver();
	}

	@Override
	public void onResume() {
		super.onResume();
		if (progressDialog != null) {
			registerReceiver(progressBroadcastReceiver, new IntentFilter(ACTION_PROGRESS));
			registerReceiver(progressBroadcastReceiver, new IntentFilter(ACTION_PZP_NOTIFICATION));
		}
	}

	@Override
	public void onPause() {
		super.onPause();
		if (progressDialog != null) {
			unregisterReceiver(progressBroadcastReceiver);
		}
	}

	@Override
	public void onDestroy() {
		super.onDestroy();
	}

	@Override
	public void onCreateContextMenu(ContextMenu menu, View v, ContextMenu.ContextMenuInfo menuInfo) {
		MenuInflater inflater = getMenuInflater();
		inflater.inflate(R.menu.widget_list_context_menu, menu);
	}

	@Override
	public boolean onContextItemSelected(MenuItem item) {
		AdapterContextMenuInfo info = (AdapterContextMenuInfo) item.getMenuInfo();
		String installId = ids[(int)info.id];
		switch(item.getItemId()) {
		case R.id.menu_uninstall:
			Intent intent = new Intent(this, WidgetUninstallActivity.class);
			intent.putExtra("installId", installId);
			startActivity(intent);
			return true;
		case R.id.menu_check_for_updates:
			Toast.makeText(this, getString(R.string.not_yet_implemented), Toast.LENGTH_SHORT).show();
			return true;
		case R.id.menu_details:
			Toast.makeText(this, getString(R.string.not_yet_implemented), Toast.LENGTH_SHORT).show();
			return true;
		default:
			return super.onContextItemSelected(item);
		}
	}

	@Override
	public boolean onCreateOptionsMenu(Menu menu) {
		/* inflate the menu items for use in the action bar */
		MenuInflater inflater = getMenuInflater();
		inflater.inflate(R.menu.widget_list_activity_actions, menu);
		
		if(stores != null) {
			for(int i = 0; i < stores.length; i++) {
				Store store = stores[i];
				menu.add(Menu.NONE, STORES_MENUITEM_BASE+i, i+1, store.name)
					.setIcon(store.icon)
					.setShowAsAction(MenuItem.SHOW_AS_ACTION_IF_ROOM);
			}
		} else {
			Log.i(TAG, "Unable to add app store");
		}
		return super.onCreateOptionsMenu(menu);
	}

	@Override
	public boolean onOptionsItemSelected(MenuItem item) {
		int itemId = item.getItemId();
		/* handle presses on the action bar items */
		switch (itemId) {
		case R.id.scan_sd_card:
			scanner.scan();
			return true;
		case R.id.pzp_settings:
			startActivity(new Intent(this, ConfigActivity.class));
			return true;
		case R.id.pzp_dashboard:
			startWrtActivityForPath("dashboard/config");
			return true;
		default: 
			if(itemId >= STORES_MENUITEM_BASE) {
				Store store = stores[itemId - STORES_MENUITEM_BASE];
				if(store != null && store.location != null) {
					Intent storeIntent = new Intent(Intent.ACTION_VIEW);
					storeIntent.setData(store.location);
					storeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
					try {
						getApplicationContext().startActivity(storeIntent);
						return true;
					} catch(Throwable t) {
						Log.e(TAG, "Unable to launch app store", t);
					}
				}
			}
			return super.onOptionsItemSelected(item);
		}
	}

	@Override
	public void onLaunch(final WidgetManagerImpl mgr) {
		/* all dependency modules are in place */
		synchronized(this) {
			if(blocked)
				runOnUiThread(new Runnable() {
					@Override
					public void run() {
						if(progressDialog != null) {
							unregisterReceiver(progressBroadcastReceiver);
							progressDialog.setProgress(PROGRESS_MAX);
							progressDialog.dismiss();
							progressDialog = null;
						}
					}
				});
			this.mgr = mgr;
		}
		mgr.addEventListener(this);
		asyncRefreshHandler.sendEmptyMessage(0);
	}

	@Override
	public Dialog onCreateDialog(int id) {
		Dialog result = scanner.createDialog(id);
		if(result == null)
			result = super.onCreateDialog(id);
		return result;
	}

	@Override
	public void onPrepareDialog(int id, Dialog dialog) {
		scanner.onPrepareDialog(id, dialog);
		super.onPrepareDialog(id, dialog);
	}

	@Override
	public void onWidgetChanged(String installId, int event) {
		asyncRefreshHandler.sendEmptyMessage(0);
	}
	
	@Override
	public void onConfigurationChanged(Configuration newConfig) {
		super.onConfigurationChanged(newConfig);
		setContentView(R.layout.activity_widget_list);
		((TextView)findViewById(android.R.id.empty)).setText(getString(R.string.no_apps_installed));
	}

	@Override
	protected void onListItemClick(ListView l, View v, int position, long id) {
		String installId = (String) getListAdapter().getItem(position);
		startWrtActivityForWidget(installId);
	}

	private void initList() {
		ids = mgr.getInstalledWidgets();
		setListAdapter(new WidgetListAdapter(this, ids));
		((TextView)findViewById(android.R.id.empty)).setText(getString(R.string.no_apps_installed));
	}

	private void startWrtActivityForWidget(String installId) {
		if(useAndroidWebView){
			Context ctx = getApplicationContext();
			Intent wrtIntent = new Intent(ACTION_START);
			wrtIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); /* Intent.FLAG_INCLUDE_STOPPED_PACKAGES */
			wrtIntent.putExtra(ID, installId);
			ctx.startActivity(wrtIntent);
		} else {
			WidgetConfig widgetConfig = mgr.getWidgetConfig(installId);
			if (widgetConfig != null) {
				String startFile = widgetConfig.startFile.path;
				startWrtActivityForPath("/apps/"+installId+"/wgt/"+startFile);
			}
		}
	}

	private void startWrtActivityForPath(String path) {
		Context ctx = getApplicationContext();
		Intent wrtIntent = new Intent(CONTENTSHELLSTART);
		wrtIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); /* Intent.FLAG_INCLUDE_STOPPED_PACKAGES */
		wrtIntent.putExtra(ID, "http://localhost:"+pzpWebsocketPort+path);
		ctx.startActivity(wrtIntent);
	}

	/********************
	 * Progress bar handling
	 *  as part of the progress handling pzp notifications are evaluated.
	 *  In final step od the initialisation the pzp port is communicated.
	 ********************/

	private class ProgressBroadcastReceiver extends BroadcastReceiver {
		@Override
		public void onReceive(Context ctx, Intent intent) {
			if(blocked && progressDialog != null) {
				String action = intent.getAction();
				Bundle extras = intent.getExtras();
				if( action.equals(ACTION_PZP_NOTIFICATION) && extras != null && extras.getString("status").equals("Initialized") ||
					action.equals(ACTION_PROGRESS) ) {
					synchronized(progressDialog) {
						progressDialog.setProgress(++progress < PROGRESS_MAX ? progress : PROGRESS_MAX);
					}
				}
				if( action.equals(ACTION_PZP_NOTIFICATION) && extras != null && extras.getString("status").startsWith("PZP_PORT:") ) {
					pzpWebsocketPort=extras.getString("status").substring(9);
				}
			}
		}
	}

	/********************
	 * Store handling
	 ********************/

	private class Store {
		String name;
		String description;
		Uri location;
		Drawable icon;
	}

	private Store readStore(Context ctx, JSONObject json) {
		Store result = new Store();
		try {
			result.name = json.getString("name");
			result.description = json.getString("description");
			result.location = Uri.parse(json.getString("location"));
			byte[] decodedString = Base64.decode(json.getString("logo"), Base64.DEFAULT);
			result.icon = (Drawable)new BitmapDrawable(BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length));
		} catch (JSONException e) {
			result = null;
		}
		return result;
	}

	private Store[] getStores() {
		Store[] result = null;
		try {
			String storesData = AssetUtils.getAssetAsString(this, STORES_FILE);
			JSONArray stores = new JSONArray(storesData);
			int count = stores.length();
			result = new Store[count];
			for(int i = 0; i < count; i++)
				result[i] = readStore(this.getApplicationContext(), stores.getJSONObject(i));
		}
		catch (IOException e1) {}
		catch (JSONException e) {}
		return result;
	}
}
