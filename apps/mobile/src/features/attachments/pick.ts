import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, UploadType } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ApiError, type UploadSource } from '@artist/api-client';
import { env } from '@/lib/env';
import { reachableStorageUrl } from '@/lib/storage-url';

export type PickFrom = 'camera' | 'photos' | 'files';

/** What was picked, plus a local picture of it for the naming sheet. */
export interface PickedUpload {
  source: UploadSource;
  /** Set for images only: the file on the phone, drawable before upload. */
  preview?: string;
}

const SOURCES: readonly [PickFrom, string][] = [
  ['camera', 'Take Photo'],
  ['photos', 'Photo Library'],
  ['files', 'Choose File'],
];

/**
 * The phone's own "where from?" menu: the system action sheet on iOS. Android
 * has no native equivalent, so it gets an alert. Three buttons is that alert's
 * limit, which leaves no room for Cancel, so tapping outside dismisses it.
 * Null when dismissed.
 */
export function chooseSource(): Promise<PickFrom | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...SOURCES.map(([, label]) => label), 'Cancel'],
          cancelButtonIndex: SOURCES.length,
        },
        (index) => resolve(SOURCES[index]?.[0] ?? null),
      );
      return;
    }
    Alert.alert(
      'Add attachment',
      undefined,
      SOURCES.map(([from, label]) => ({ text: label, onPress: () => resolve(from) })),
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

/**
 * Asks the person for one file and describes it as an `UploadSource` — the
 * phone's half of `@artist/api-client`'s upload flow. Null when they cancel or
 * refuse permission.
 *
 * Camera is stills only: recording video would also ask for the microphone,
 * a second prompt for something a band dashboard rarely needs. Videos already
 * on the phone come in through Photos.
 */
export async function pickUpload(from: PickFrom): Promise<PickedUpload | null> {
  if (from === 'files') {
    const result = await DocumentPicker.getDocumentAsync({
      // Copied into the app's cache so the native uploader can read it after
      // the picker's temporary grant has gone.
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return {
      source: fromUri(asset.uri, asset.name, asset.mimeType, asset.size),
      preview: asset.mimeType?.startsWith('image/') ? asset.uri : undefined,
    };
  }

  if (from === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      explainDenied('camera');
      return null;
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: from === 'camera' ? ['images'] : ['images', 'videos'],
    // Re-encodes to JPEG. An iPhone's HEIC original is unreadable in most
    // browsers, and the bandmate opening it is likely on web.
    quality: 0.85,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
  const result =
    from === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;

  const asset = result.assets[0];
  const mimeType =
    asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  return {
    source: fromUri(
      asset.uri,
      // The camera hands back no name at all; a dated one beats "image".
      asset.fileName ?? defaultName(mimeType),
      mimeType,
      asset.fileSize,
    ),
    preview: asset.type === 'video' ? undefined : asset.uri,
  };
}

function fromUri(
  uri: string,
  fileName: string,
  mimeType: string | undefined,
  size: number | undefined,
): UploadSource {
  const file = new File(uri);
  return {
    fileName,
    contentType: mimeType ?? '',
    size: size ?? file.size,
    put: async (signedUrl, contentType) => {
      // Uploaded natively from disk: a 40MB video never passes through JS.
      const result = await file.upload(
        reachableStorageUrl(signedUrl, env.supabaseUrl),
        {
          httpMethod: 'PUT',
          uploadType: UploadType.BINARY_CONTENT,
          headers: { 'Content-Type': contentType },
          // The flow awaits this and then persists the row, so the transfer
          // has to finish while the JS that is waiting for it is alive.
          sessionType: 'foreground',
        },
      );
      if (result.status < 200 || result.status >= 300) {
        throw new ApiError(result.status, 'Storage rejected the upload');
      }
    },
  };
}

function defaultName(mimeType: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const kind = mimeType.startsWith('video/') ? 'video' : 'photo';
  return `${kind}-${stamp}.${extension}`;
}

/** Once refused, the OS will not ask again — only Settings can undo it. */
function explainDenied(what: string) {
  Alert.alert(
    `No access to the ${what}`,
    `Allow it in Settings to attach from the ${what}.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ],
  );
}
