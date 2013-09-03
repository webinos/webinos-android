/* This file has been automatically generated; do not edit */

package org.meshpoint.anode.stub.gen.platform;

public class Org_webinos_api_media_PlaybackManager {

	private static Object[] __args = new Object[2];

	public static Object[] __getArgs() { return __args; }

	static Object __invoke(org.webinos.api.media.PlaybackManager inst, int opIdx, Object[] args) {
		Object result = null;
		switch(opIdx) {
		case 0: /* backward */
			inst.backward(
				(org.webinos.api.media.MediaCallback)args[0]
			);
			break;
		case 1: /* forward */
			inst.forward(
				(org.webinos.api.media.MediaCallback)args[0]
			);
			break;
		case 2: /* play */
			inst.play(
				(String)args[0],
				(org.webinos.api.media.MediaCallback)args[1]
			);
			break;
		case 3: /* playPause */
			inst.playPause(
				(org.webinos.api.media.MediaCallback)args[0]
			);
			break;
		case 4: /* stop */
			inst.stop(
				(org.webinos.api.media.MediaCallback)args[0]
			);
			break;
		case 5: /* volumeDown */
			inst.volumeDown(
				(org.webinos.api.media.MediaCallback)args[0]
			);
			break;
		case 6: /* volumeUp */
			inst.volumeUp(
				(org.webinos.api.media.MediaCallback)args[0]
			);
			break;
		default:
		}
		return result;
	}

}
