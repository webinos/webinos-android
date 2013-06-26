/* This file has been automatically generated; do not edit */

package org.meshpoint.anode.stub.gen.dict;

public class Org_webinos_android_app_wrt_mgr_ComparisonResult {

	private static Object[] __args = new Object[4];

	public static Object[] __getArgs() { return __args; }

	public static void __import(org.webinos.android.app.wrt.mgr.ComparisonResult ob, Object[] vals) {
		ob.existingConfig = (org.webinos.android.app.wrt.mgr.WidgetConfig)vals[0];
		ob.existingHasUserdata = ((org.meshpoint.anode.js.JSValue)vals[1]).getBooleanValue();
		ob.existingValidationResult = (org.webinos.android.app.wrt.mgr.ValidationResult)vals[2];
		ob.replacement = (org.webinos.android.app.wrt.mgr.ProcessingResult)vals[3];
	}

	public static Object[] __export(org.webinos.android.app.wrt.mgr.ComparisonResult ob) {
		__args[0] = ob.existingConfig;
		__args[1] = org.meshpoint.anode.js.JSValue.asJSBoolean(ob.existingHasUserdata);
		__args[2] = ob.existingValidationResult;
		__args[3] = ob.replacement;
		return __args;
	}

}
