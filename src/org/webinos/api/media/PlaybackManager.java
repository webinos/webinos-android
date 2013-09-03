package org.webinos.api.media;

import org.meshpoint.anode.bridge.Env;
import org.meshpoint.anode.java.Base;

public abstract class PlaybackManager extends Base {
	private static short classId = Env.getInterfaceId(PlaybackManager.class);

	protected PlaybackManager() {
		super(classId);
	}

	public abstract void play(String path, MediaCallback callback);

	public abstract void playPause(MediaCallback callback);

	public abstract void stop(MediaCallback callback);

	public abstract void forward(MediaCallback callback);

	public abstract void backward(MediaCallback callback);

	public abstract void volumeUp(MediaCallback callback);

	public abstract void volumeDown(MediaCallback callback);
}
