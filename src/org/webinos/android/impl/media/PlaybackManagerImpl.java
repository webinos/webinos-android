package org.webinos.android.impl.media;

import java.util.List;
import java.util.Locale;

import org.meshpoint.anode.AndroidContext;
import org.meshpoint.anode.module.IModule;
import org.meshpoint.anode.module.IModuleContext;
import org.webinos.api.media.MediaCallback;
import org.webinos.api.media.PlaybackManager;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Log;

public class PlaybackManagerImpl extends PlaybackManager implements IModule {

	private static final String TAG = PlaybackManagerImpl.class.getName();
	private IModuleContext moduleContext;
	private Context androidContext;

	@Override
	public Object startModule(IModuleContext ctx) {
		Log.v(TAG, "startModule");
		this.moduleContext = ctx;
		this.androidContext = ((AndroidContext) ctx).getAndroidContext();
		return this;
	}

	@Override
	public void stopModule() {
		Log.v(TAG, "stopModule");
	}

	@Override
	public void play(String urlstr, MediaCallback callback) {
	    // Do video playback via VLC as VideoView can't handle MPEG-TS
	    // or raw H.264
	
	    // Arno, 2012-10-24: Volatile, if VLC radically changes package
	    // name, we doomed. But normal Intent searching won't grok
	    // VLC's hack with the demuxer in the scheme: http/h264:
	    // so we have to do it this way.
	    //
	    String pkgname = getPackageNameForVLC("org.videolan.vlc.betav7neon");
	    if (pkgname == "") {
	    	callback.onCallback(true);
	    	return;
	    }

	    // Arno, 2012-10-24: LIVESOURCE=ANDROID
	    // Force VLC to use H.264 demuxer via URL, see
	    // http://wiki.videolan.org/VLC_command-line_help
	    // urlstr += " :network-caching=50";
	    // urlstr += " :http-caching=50";

	    Uri intentUri = Uri.parse(urlstr);

	    Intent intent = new Intent();
	    ComponentName cn = new ComponentName(pkgname, pkgname + ".gui.video.VideoPlayerActivity");
	    intent.setComponent(cn);
	    intent.setAction(Intent.ACTION_VIEW);
	    intent.setData(intentUri);
		intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

	    try {
	    	androidContext.startActivity(intent);
	    } catch (Exception e) {
	    	callback.onCallback(true);
	    }
	    callback.onCallback(false);
	}

	private String getPackageNameForVLC(String vlcCurrentPackageName) {
		String vlcpkgnameprefix = "org.videolan.vlc";
		try {
			// From
			// http://stackoverflow.com/questions/2780102/open-another-application-from-your-own-intent
			Intent intent = new Intent("android.intent.action.MAIN");
			intent.addCategory("android.intent.category.LAUNCHER");

			intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
			List<ResolveInfo> resolveinfo_list = androidContext.getPackageManager().queryIntentActivities(intent, 0);

			for (ResolveInfo info : resolveinfo_list) {
				String ilcpn = info.activityInfo.packageName.toLowerCase(Locale.US);
				if (ilcpn.startsWith(vlcpkgnameprefix)) {
					return info.activityInfo.packageName;
				}
			}

			// VLC not found, prompt user to install
			openPlayStore(vlcCurrentPackageName);
		} catch (Exception e) {
			openPlayStore(vlcCurrentPackageName);
		}
		return "";
	}

	private void openPlayStore(String packageName) {
		Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packageName));
		intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
		androidContext.startActivity(intent);
	}

	@Override
	public void playPause(MediaCallback callback) {
		// TODO Auto-generated method stub
		
	}

	@Override
	public void stop(MediaCallback callback) {
		// TODO Auto-generated method stub
		
	}

	@Override
	public void forward(MediaCallback callback) {
		// TODO Auto-generated method stub
		
	}

	@Override
	public void backward(MediaCallback callback) {
		// TODO Auto-generated method stub
		
	}

	@Override
	public void volumeUp(MediaCallback callback) {
		// TODO Auto-generated method stub
		
	}

	@Override
	public void volumeDown(MediaCallback callback) {
		// TODO Auto-generated method stub
		
	}
}
