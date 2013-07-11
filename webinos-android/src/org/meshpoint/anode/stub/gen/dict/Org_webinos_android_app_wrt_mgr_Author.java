/* This file has been automatically generated; do not edit */

package org.meshpoint.anode.stub.gen.dict;

public class Org_webinos_android_app_wrt_mgr_Author {

	private static Object[] __args = new Object[3];

	public static Object[] __getArgs() { return __args; }

	public static void __import(org.webinos.android.app.wrt.mgr.Author ob, Object[] vals) {
		ob.email = (String)vals[0];
		ob.href = (String)vals[1];
		ob.name = (org.webinos.android.app.wrt.mgr.LocalisableString)vals[2];
	}

	public static Object[] __export(org.webinos.android.app.wrt.mgr.Author ob) {
		__args[0] = ob.email;
		__args[1] = ob.href;
		__args[2] = ob.name;
		return __args;
	}

}
