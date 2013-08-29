package org.webinos.api.mediacontent;

public interface ThumbnailCallback {
  void onSuccess(Boolean isErr, byte[] thumbnail);
}
