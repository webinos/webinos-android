/* This file has been automatically generated; do not edit */

package org.meshpoint.anode.stub.gen.platform;

public class Org_webinos_api_mediacontent_MediaLyrics {

	private static Object[] __args = new Object[0];

	public static Object[] __getArgs() { return __args; }

	static Object __get(org.webinos.api.mediacontent.MediaLyrics inst, int attrIdx) {
		Object result = null;
		switch(attrIdx) {
		case 0: /* LYRICS_TYPE_SYNCHRONIZED */
			result = org.webinos.api.mediacontent.MediaLyrics.LYRICS_TYPE_SYNCHRONIZED;
			break;
		case 1: /* LYRICS_TYPE_UNSYNCHRONIZED */
			result = org.webinos.api.mediacontent.MediaLyrics.LYRICS_TYPE_UNSYNCHRONIZED;
			break;
		case 2: /* texts */
			result = inst.texts;
			break;
		case 3: /* timestamps */
			result = inst.timestamps;
			break;
		case 4: /* type */
			result = inst.type;
			break;
		default:
		}
		return result;
	}

	static void __set(org.webinos.api.mediacontent.MediaLyrics inst, int attrIdx, Object val) {
		switch(attrIdx) {
		case 0: /* LYRICS_TYPE_SYNCHRONIZED */
			org.webinos.api.mediacontent.MediaLyrics.LYRICS_TYPE_SYNCHRONIZED = (String)val;
			break;
		case 1: /* LYRICS_TYPE_UNSYNCHRONIZED */
			org.webinos.api.mediacontent.MediaLyrics.LYRICS_TYPE_UNSYNCHRONIZED = (String)val;
			break;
		case 2: /* texts */
			inst.texts = (String[])val;
			break;
		case 3: /* timestamps */
			inst.timestamps = (long[])val;
			break;
		case 4: /* type */
			inst.type = (String)val;
			break;
		default:
			throw new UnsupportedOperationException();
		}
	}

}
