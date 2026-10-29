import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { fetchAttachmentUrl, notify, type AttachmentDto } from '@artist/api-client';
import { reportError } from '@/lib/report-error';
import { env } from '@/lib/env';
import { reachableStorageUrl } from '@/lib/storage-url';
import { savesToPhotos } from './attachment-kind';

/**
 * Puts an attachment on the phone.
 *
 * Photos and videos go straight into the photo library, which is where anyone
 * looks for a picture they just saved. Anything else opens the share sheet,
 * whose "Save to Files" is iOS's own answer to "save this document" — and
 * which also covers AirDrop, Messages and the rest without asking which.
 *
 * Downloaded first under its own name, so what lands on the phone is called
 * what the band named it, not the storage key.
 */
export async function saveToDevice(boardId: string, attachment: AttachmentDto) {
  try {
    const { url } = await fetchAttachmentUrl(boardId, attachment.id, 'download');
    const folder = new Directory(Paths.cache, 'attachments', attachment.id);
    folder.create({ intermediates: true, idempotent: true });
    const file = await File.downloadFileAsync(
      reachableStorageUrl(url, env.supabaseUrl),
      new File(folder, attachment.fileName),
      { idempotent: true },
    );

    if (savesToPhotos(attachment.mimeType)) {
      // Write-only: saving needs no reading of the person's library.
      const permission = await requestPermissionsAsync(true);
      if (!permission.granted) {
        notify.error('Allow Photos access in Settings to save here');
        return;
      }
      await Asset.create(file.uri);
      notify.success('Saved to Photos');
      return;
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: attachment.mimeType,
      dialogTitle: attachment.fileName,
    });
  } catch (error) {
    // The native text ("PHPhotosErrorDomain 3311") means nothing to a user;
    // the reporter gets it, the user gets a sentence.
    reportError(error);
    notify.error('Could not save the file. Try again.');
  }
}
