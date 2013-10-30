package org.webinos.android.impl.mediacontent;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.webinos.android.impl.mediacontent.Mapping.CompositeDbField;
import org.webinos.android.impl.mediacontent.Mapping.DbField;
import org.webinos.android.impl.mediacontent.Mapping.SingleDbField;
import org.webinos.api.DeviceAPIError;
import org.webinos.api.mediacontent.FilterValues;
import org.webinos.api.mediacontent.MediaAudio;
import org.webinos.api.mediacontent.MediaContentErrorCallback;
import org.webinos.api.mediacontent.MediaFolder;
import org.webinos.api.mediacontent.MediaFolderSuccessCallback;
import org.webinos.api.mediacontent.MediaImage;
import org.webinos.api.mediacontent.MediaItem;
import org.webinos.api.mediacontent.MediaItemCollection;
import org.webinos.api.mediacontent.MediaItemSuccessCallback;
import org.webinos.api.mediacontent.MediaSource;
import org.webinos.api.mediacontent.MediaVideo;
import org.webinos.api.mediacontent.SortMode;
import org.webinos.api.mediacontent.ThumbnailCallback;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Environment;
import android.os.FileObserver;
import android.provider.MediaStore;
import android.util.Log;

import org.blinkenlights.jid3.*;
import org.blinkenlights.jid3.v1.*;
import org.blinkenlights.jid3.v2.*;

class LocalMediaSource extends MediaSource {
  private Context ctx;
  private GetFoldersStrategy getFoldersStrategy;
  private String volumeName;
  private String storageType;
  private String[] toplevelMediaFolders = null;
  private Map<String, FolderObserver> folderObservers = new HashMap<String, FolderObserver>();
  
  ContentResolver contentResolver;
  Uri contentUri;

  enum GetFoldersStrategy { ALL, STANDARD_FOLDERS };

  public LocalMediaSource(
      Context ctx,
      String volumeName,
      GetFoldersStrategy getFoldersStrategy) {
    this.ctx = ctx;
    this.volumeName = volumeName;
    this.getFoldersStrategy = getFoldersStrategy;
    this.contentResolver = ctx.getContentResolver();
    this.contentUri = MediaStore.Files.getContentUri(this.volumeName);

    if(this.volumeName.equals("internal"))
      this.storageType = MediaFolder.STORAGE_TYPE_INTERNAL;
    else if(this.volumeName.equals("external"))
      this.storageType = MediaFolder.STORAGE_TYPE_EXTERNAL;
    else
      throw new DeviceAPIError(DeviceAPIError.INVALID_ERROR);

    if(this.getFoldersStrategy.equals(GetFoldersStrategy.STANDARD_FOLDERS)) {
      this.toplevelMediaFolders = new String[] {
        Environment.DIRECTORY_MUSIC,
        Environment.DIRECTORY_PICTURES,
        Environment.DIRECTORY_MOVIES,
        Environment.DIRECTORY_DOWNLOADS,
        Environment.DIRECTORY_DCIM
      };
    } else if(this.getFoldersStrategy.equals(GetFoldersStrategy.ALL)) {
      this.toplevelMediaFolders = new String[] {
        Environment.getExternalStorageDirectory().toString()
      };
    }

    /* observe all subfolders to reflect changes into MediaStore */
    for(String folderPath : this.toplevelMediaFolders)
      addFolderObservers(folderPath);
  }

  @Override
  public void getFolders(
      MediaFolderSuccessCallback successCallback,
      MediaContentErrorCallback errorCallback) {
    if(getFoldersStrategy.equals(GetFoldersStrategy.STANDARD_FOLDERS)) {
      List<MediaFolder> folders = new ArrayList<MediaFolder>();
      if(storageType.equals(MediaFolder.STORAGE_TYPE_EXTERNAL)) {
        int i = 0;
        for(String folderName : toplevelMediaFolders) {
          File folder = Environment.getExternalStoragePublicDirectory(folderName);
          if(folder != null && folder.exists() && folder.isDirectory()) {
            folders.add(new MediaFolder(
                String.valueOf(i++),
                folder.getPath(),
                folder.getName(),
                storageType,
                new Date(folder.lastModified())
              )
            );
          }
        }
      }
      if(successCallback != null)
        successCallback.onSuccess(folders.toArray(new MediaFolder[folders.size()]));
    } else if(getFoldersStrategy.equals(GetFoldersStrategy.ALL)) {
      GetFoldersOperation op = new GetFoldersOperation(
        storageType,
        successCallback,
        errorCallback
      );
      new Thread(op).start();
    }
  }

  @Override
  public void findItems(
      MediaItemSuccessCallback successCallback,
      MediaContentErrorCallback errorCallback,
      String folderId,
      FilterValues filterValues,
      SortMode sortMode,
      long count,
      long offset) {
    FindItemsOperation op = new FindItemsOperation(
      successCallback,
      errorCallback,
      folderId,
      AbstractFilter.getFilter(filterValues),
      sortMode,
      2,
      0
    );
    new Thread(op).start();
  }

  @Override
  public void getThumb(final long id, final ThumbnailCallback callback) {
    GetThumbOperation op = new GetThumbOperation(
      this.ctx.getContentResolver(),
      id,
      callback
    );
    new Thread(op).start();
  }

  /***************
   * Observe folders
   ***************/

  private class FolderObserver extends FileObserver {
    private Context ctxLocalMediaSource;

    public FolderObserver(String path) {
      super(path);
      this.ctxLocalMediaSource = ctx; 
    }

    @Override
    public void onEvent(int event, String path) {
      if(event == FileObserver.MODIFY) {
        Log.d("FolderObserver", "event: " + event + " path: " + path);
        ctxLocalMediaSource.sendBroadcast(new Intent(
            Intent.ACTION_MEDIA_MOUNTED,
            Uri.parse("file://" + Environment.getExternalStorageDirectory())
          )
        );
      }
    }
  }

  private void addFolderObservers(String directoryName) {
    File directory = new File(directoryName);
    if(directory != null && directory.isDirectory()) {
      FolderObserver folderObserver = new FolderObserver(directoryName);
      if(!folderObservers.containsKey(directoryName))
        folderObservers.put(directoryName, folderObserver);
      folderObservers.get(directoryName).startWatching();
      Log.d("LocalMediaSource", "add observer: " + directoryName);
      File[] fList = directory.listFiles();
      if(fList != null)
        for(File file : fList)
          if(file.isDirectory()) addFolderObservers(file.getAbsolutePath());
    }
  }

  /***************
   * Get folders
   ***************/

  private static String commaSeparatedStringFromArray(String[] array) {
    StringBuffer buf = new StringBuffer();
    if(array != null && array.length > 0) {
      buf.append(array[0]);
      for(int i = 1; i < array.length; i++) {
        buf.append(",");
        buf.append(array[i]);
      }
    }
    return buf.toString();
  }

  private class GetFoldersOperation implements Runnable {
    private String storageType;
    private MediaFolderSuccessCallback successCallback;
    private MediaContentErrorCallback errorCallback;

    public GetFoldersOperation(
        String storageType,
        MediaFolderSuccessCallback successCallback,
        MediaContentErrorCallback errorCallback) {
      this.storageType = storageType;
      this.successCallback = successCallback;
      this.errorCallback = errorCallback;
    }

    @Override
    public void run() {
      try {
        Cursor cursor = null;
        List<String> mediaFolderIds = new ArrayList<String>();
        String[] projection = {
          "DISTINCT " + MediaStore.Files.FileColumns.PARENT
        };
        String selection = MediaStore.Files.FileColumns.MEDIA_TYPE
          + " IN("
          + commaSeparatedStringFromArray(new String[] {
              String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_AUDIO),
              String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO),
              String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE) })
          + ")";
        String[] selectionArgs = null;
        try {
          cursor = contentResolver.query(
            contentUri,
            projection,
            selection,
            selectionArgs,
            null
          );
          while(cursor.moveToNext()) mediaFolderIds.add(cursor.getString(0));
        } finally {
          if(cursor != null) cursor.close();
        }

        List<MediaFolder> mediaFolders = new ArrayList<MediaFolder>();
        projection = new String[] {
          "DISTINCT " + MediaStore.Files.FileColumns._ID,
          MediaStore.Files.FileColumns.DATA,
          MediaStore.Files.FileColumns.TITLE,
          MediaStore.Files.FileColumns.DATE_MODIFIED
        };
        selection = MediaStore.Files.FileColumns._ID
            + " IN("
            + commaSeparatedStringFromArray(
                mediaFolderIds.toArray(new String[mediaFolderIds.size()])
              )
            + ")";
        selectionArgs = null;
        try {
          cursor = contentResolver.query(
            contentUri,
            projection,
            selection,
            selectionArgs,
            null
          );
          while(cursor.moveToNext()) {
            MediaFolder mediaFolder = new MediaFolder(
              cursor.getString(0),
              cursor.getString(1),
              cursor.getString(2),
              storageType,
              new Date(cursor.getLong(3) * 1000)
            );
            mediaFolders.add(mediaFolder);
          }
        } finally {
          if(cursor != null) cursor.close();
        }

        if(successCallback != null) {
          successCallback.onSuccess(
            mediaFolders.toArray(new MediaFolder[mediaFolders.size()])
          );
        }
      } catch (Exception e) {
        if(errorCallback != null) errorCallback.onError(e.toString());
      }
    }
  }

  /***************
   * Get items
   ***************/

  private Object getValue(Cursor cursor, SingleDbField dbField) {
    Object value = null;
    int index = cursor.getColumnIndex(dbField.getName());
    if(index != -1) {
      if(cursor.getType(index) == Cursor.FIELD_TYPE_STRING) {
        value = cursor.getString(index);
      } else if(cursor.getType(index) == Cursor.FIELD_TYPE_INTEGER) {
        value = cursor.getLong(index);
      } else if(cursor.getType(index) == Cursor.FIELD_TYPE_FLOAT) {
        value = cursor.getDouble(index);
      }
    }
    if(dbField.getTranslator() != null) {
      value = dbField.getTranslator().getAttribValue(value);
    }
    return value;
  }

  private class FindItemsOperation implements Runnable {
    private MediaItemSuccessCallback successCallback;
    private MediaContentErrorCallback errorCallback;
    private String folderId;
    private AbstractFilter filter;
    private SortMode sortMode;
    private long count;
    private long offset;

    public FindItemsOperation(
        MediaItemSuccessCallback successCallback,
        MediaContentErrorCallback errorCallback,
        String folderId,
        AbstractFilter filter,
        SortMode sortMode,
        long count,
        long offset) {
      this.successCallback = successCallback;
      this.errorCallback = errorCallback;
      this.folderId = folderId;
      this.filter = filter;
      this.sortMode = sortMode;
      this.count = count;
      this.offset = offset;
    }

    @Override
    public void run() {
      Cursor cursor = null;
      try {
        String[] projection = Mapping.getProjection();
        String[] selectionArgs = null;
        String selection = MediaStore.Files.FileColumns.MEDIA_TYPE
            + " != "
            + MediaStore.Files.FileColumns.MEDIA_TYPE_NONE;

        if(filter != null) {
          SelectStatement selectStmt = QueryBuilder.getSelect(filter);
          if(selectStmt != null) {
            selection += " AND " + selectStmt.getStatement();
            selectionArgs = selectStmt.getArgs();
          }
        }

        if(folderId != null) {
          selection += " AND "
              + MediaStore.Files.FileColumns.PARENT
              + " = "
              + folderId;
        }

        String sortOrder = null;
        if(sortMode != null) {
          DbField dbField = Mapping.getDbField(sortMode.attributeName);
          if(dbField instanceof SingleDbField) {
            sortOrder = ((SingleDbField)dbField).getName()
                + " "
                + sortMode.sortModeOrder;
          } else {
            throw new DeviceAPIError(DeviceAPIError.INVALID_VALUES_ERR);
          }
        }

        List<MediaItem> mediaItems = new ArrayList<MediaItem>();

        Map<String, Object> valueSet = new HashMap<String, Object>();
        cursor = contentResolver.query(
          contentUri,
          projection,
          selection,
          selectionArgs,
          sortOrder
        );

        while(cursor.moveToNext()) {
          for(String attribute : Mapping.getAttributes()) {
            DbField dbField = Mapping.getDbField(attribute);
            if(dbField instanceof SingleDbField) {
              SingleDbField singleDbField = (SingleDbField) dbField;
              Object attribValue = getValue(cursor, singleDbField);
              if(attribValue != null) {
                valueSet.put(attribute, attribValue);
              }
            } else if(dbField instanceof CompositeDbField) {
              CompositeDbField compositeDbField = (CompositeDbField) dbField;
              Object[] values = new Object[compositeDbField.getDbFields().length];
              int i = 0;
              for(SingleDbField singleDbField : compositeDbField.getDbFields()) {
                values[i++] = getValue(cursor, singleDbField);
              }
              if(compositeDbField.getCompositeHandler() != null) {
                Object attribValue = compositeDbField.getCompositeHandler().getComposite(values);
                if(attribValue != null) valueSet.put(attribute, attribValue);
              } else {
                throw new DeviceAPIError(DeviceAPIError.INVALID_ERROR);
              }
            }
          }

          String mediaType = (String)valueSet.get("type");
          if(valueSet.containsKey("itemURI") &&
              (new File((String)valueSet.get("itemURI"))).exists()) {
            if(MediaItem.MEDIATYPE_AUDIO.equals(mediaType)) {
              mediaItems.add(newMediaAudio(valueSet));
            } else if(MediaItem.MEDIATYPE_VIDEO.equals(mediaType)) {
              mediaItems.add(newMediaVideo(valueSet));
            } else if(MediaItem.MEDIATYPE_IMAGE.equals(mediaType)) {
              mediaItems.add(newMediaImage(valueSet));
            } else if(MediaItem.MEDIATYPE_UNKNOWN.equals(mediaType)) {
              /* do nothing */
            }
          }
        }

        MediaItemCollection mediaItemCollection = new MediaItemCollection();
        mediaItemCollection.size = mediaItems.size();
        mediaItemCollection.audios = new MediaAudio[mediaItemCollection.size];
        mediaItemCollection.images = new MediaImage[mediaItemCollection.size];
        mediaItemCollection.videos = new MediaVideo[mediaItemCollection.size];

        for(int i = 0; i < mediaItems.size(); i++) {
          if(mediaItems.get(i) instanceof MediaAudio) {
            mediaItemCollection.audios[i] = (MediaAudio)mediaItems.get(i);
          } else if(mediaItems.get(i) instanceof MediaImage) {
            mediaItemCollection.images[i] = (MediaImage)mediaItems.get(i);
          } else if(mediaItems.get(i) instanceof MediaVideo) {
            mediaItemCollection.videos[i] = (MediaVideo)mediaItems.get(i);
          }
        }

        if(successCallback != null)
          successCallback.onSuccess(mediaItemCollection);
      } catch (Exception e) {
        if(errorCallback != null) errorCallback.onError(e.toString());
      } finally {
        if(cursor != null) cursor.close();
      }
    }

    private MediaAudio newMediaAudio(Map<String, Object> valueSet) {
      MediaAudio mediaAudio = new MediaAudio(valueSet);
      if(mediaAudio.itemURI != null) {
        String filenameArray[] = mediaAudio.itemURI.split("\\.");
        if(filenameArray[filenameArray.length - 1].equalsIgnoreCase("mp3")) {
          /* handling MediaMetadataRetriever limitation, MP3 file handling with
           * JID3 */
          File oSourceFile = new File(mediaAudio.itemURI);
          MediaFile oMediaFile = new MP3File(oSourceFile);
          try {
            ID3Tag[] aoID3Tag = oMediaFile.getTags();
            for(int i=0; i < aoID3Tag.length; i++) {
              if(aoID3Tag[i] instanceof ID3V1_0Tag) {
                ID3V1_0Tag oID3V1_0Tag = (ID3V1_0Tag)aoID3Tag[i];
                mediaAudio.album = oID3V1_0Tag.getAlbum();
                mediaAudio.artists = new String[] {oID3V1_0Tag.getArtist()};
                mediaAudio.genres = new String[] {oID3V1_0Tag.getGenre().toString()};
                /* composers not supported by ID3V1_0Tag */
                /* lyrics not supported by ID3V1_0Tag */
                /* copyright not supported by ID3V1_0Tag */
                /* bitrate not supported by ID3V1_0Tag */
                /* trackNumber not supported by ID3V1_0Tag */
                /* duration not supported by ID3V1_0Tag */
                /* playedTime not supported by ID3V1_0Tag */
                /* playCount not supported by ID3V1_0Tag */
              } else if(aoID3Tag[i] instanceof ID3V2_3_0Tag) {
                ID3V2_3_0Tag oID3V2_3_0Tag = (ID3V2_3_0Tag)aoID3Tag[i];
                mediaAudio.album = oID3V2_3_0Tag.getAlbum();
                mediaAudio.artists = new String[] {oID3V2_3_0Tag.getArtist()};
                mediaAudio.genres = new String[] {oID3V2_3_0Tag.getGenre()};
                mediaAudio.trackNumber = oID3V2_3_0Tag.getTrackNumber();
                /* composers not supported by ID3V2_3_0Tag */
                /* lyrics not supported by ID3V2_3_0Tag */
                /* copyright not supported by ID3V2_3_0Tag */
                /* bitrate not supported by ID3V2_3_0Tag */
                /* duration not supported by ID3V2_3_0Tag */
                /* playedTime not supported by ID3V2_3_0Tag */
                /* playCount not supported by ID3V2_3_0Tag */
              }
            }
          } catch (ID3Exception e) {
            Log.d("NewMediaAudio", "Getting mp3 tag error for " + mediaAudio.itemURI + " Exception: " + e);
          }
        }
        /* use MediaMetadataRetriever to get media tags */
        MediaMetadataRetriever mmr = new MediaMetadataRetriever();
        mmr.setDataSource(mediaAudio.itemURI);
        try {
          if(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM) != null)
            mediaAudio.album = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);

          if(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST) != null)
            mediaAudio.artists = new String[] {
              mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)
            };

          if(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_GENRE) != null)
            mediaAudio.genres = new String[] {
              mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_GENRE)
            };

          if(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_COMPOSER) != null)
            mediaAudio.composers = new String[] {
              mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_COMPOSER)
            };

          mediaAudio.trackNumber = Integer.parseInt(
            mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER)
          );

          mediaAudio.duration = Long.parseLong(
            mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION),
            10
          );

          /* lyrics not supported by MediaMetadataRetriever */
          /* copyright not supported by MediaMetadataRetriever */
          /* bitrate not supported by MediaMetadataRetriever */
          /* playedTime not supported by MediaMetadataRetriever */
          /* playCount not supported by MediaMetadataRetriever */
          mmr.release();
        } catch (Exception e) {
          Log.d("NewMeidaAudio", "Metadata retrieving error for: " + mediaAudio.itemURI + " Exception: " + e);
        }
        /* unrecognised audio safety */
        checkForNullTagsAudio(mediaAudio);
      }

      Log.d("api", "album of " + mediaAudio.itemURI + " is " + mediaAudio.album);
      Log.d("api", "artists of " + mediaAudio.itemURI + " is " + mediaAudio.artists[0]);
      return mediaAudio;
    }

    private void checkForNullTagsAudio(MediaAudio mediaAudio) {
      if(mediaAudio.album == null)
        mediaAudio.album = "Unknown";
      if(mediaAudio.artists == null)
        mediaAudio.artists = new String[] {"Unknown"};
      else if(mediaAudio.artists[0] == null)
        mediaAudio.artists[0] = "Unknown";
      if(mediaAudio.genres == null)
        mediaAudio.genres = new String[] {"Unknown"};
      else if(mediaAudio.genres[0] == null)
        mediaAudio.genres[0] = "Unknown";
    }

    private MediaVideo newMediaVideo(Map<String, Object> valueSet) {
      MediaVideo mediaVideo = new MediaVideo(valueSet);
      if(mediaVideo.itemURI != null) {
        /* use MediaMetadataRetriever to get media tags */
        MediaMetadataRetriever mmr = new MediaMetadataRetriever();
        mmr.setDataSource(mediaVideo.itemURI);
        try {
          mediaVideo.album = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
          if(mediaVideo.album == null) mediaVideo.album = "Unknown";
          mediaVideo.artists = new String[] {
            mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)
          };
          if(mediaVideo.artists[0] == null) mediaVideo.artists[0] = "Unknown";
          mediaVideo.duration = Long.parseLong(
            mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION),
            10
          );
          /* geolocation not supported by MediaMetadataRetriever */
          /* width not supported by MediaMetadataRetriever */
          /* height not supported by MediaMetadataRetriever */
          /* playedTime not supported by MediaMetadataRetriever */
          /* playCount not supported by MediaMetadataRetriever */
          mmr.release();
        } catch(Exception e) {
          Log.d("NewMeidaVideo", "Metadata retrieving error for: " + mediaVideo.itemURI + " Exception: " + e);
        } finally {
          /* unrecognised video safety */
          if(mediaVideo.album == null)
            mediaVideo.album = "Unknown";
          if(mediaVideo.artists == null)
            mediaVideo.artists = new String[] {"Unknown"};
          else if(mediaVideo.artists[0] == null)
            mediaVideo.artists[0] = "Unknown";
        }
      }

      Log.d("api", "album of " + mediaVideo.itemURI + " is " + mediaVideo.album);
      Log.d("api", "artists of " + mediaVideo.itemURI + " is " + mediaVideo.artists[0]);
      return mediaVideo;
    }

    private MediaImage newMediaImage(Map<String, Object> valueSet) {
      return (new MediaImage(valueSet));
    }
  }

  /***************
   * Get thumbs
   ***************/

  private class GetThumbOperation implements Runnable {
    private ContentResolver contentResolver;
    private long id;
    private ThumbnailCallback callback;

    public GetThumbOperation(
        ContentResolver contentResolver,
        long id,
        ThumbnailCallback callback) {
      this.contentResolver = contentResolver;
      this.id = id;
      this.callback = callback;
    }

    @Override
    public void run() {
      BitmapFactory.Options options=new BitmapFactory.Options();
      options.inSampleSize = 1;
      Bitmap curThumb = MediaStore.Images.Thumbnails.getThumbnail(
        contentResolver,
        id,
        MediaStore.Video.Thumbnails.MICRO_KIND,
        options
      );

      if(curThumb == null) {
        callback.onSuccess(true, null);
        return;
      }

      ByteArrayOutputStream out = new ByteArrayOutputStream();
      boolean isCompressed = curThumb.compress(
        Bitmap.CompressFormat.JPEG,
        80,
        out
      );
      byte[] bytes = out.toByteArray();
      callback.onSuccess(!isCompressed, bytes);
    }
  }
}
