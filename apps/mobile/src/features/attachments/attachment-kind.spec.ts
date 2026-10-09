import { attachmentKind, pageAfterDelete, savesToPhotos } from './attachment-kind';

describe('attachmentKind', () => {
  it('reads the family from the mime type', () => {
    expect(attachmentKind('image/heic')).toBe('image');
    expect(attachmentKind('video/quicktime')).toBe('video');
    expect(attachmentKind('audio/wav')).toBe('audio');
    expect(attachmentKind('application/pdf')).toBe('pdf');
    expect(attachmentKind('application/zip')).toBe('other');
  });

  it('sends only pictures and videos to the photo library', () => {
    expect(savesToPhotos('image/jpeg')).toBe(true);
    expect(savesToPhotos('video/mp4')).toBe(true);
    expect(savesToPhotos('application/pdf')).toBe(false);
    expect(savesToPhotos('audio/mpeg')).toBe(false);
  });
});

describe('pageAfterDelete', () => {
  it('stays on the same page, now showing the next file', () => {
    expect(pageAfterDelete(1, 3)).toBe(1);
  });

  it('steps back when the last file was deleted', () => {
    expect(pageAfterDelete(3, 3)).toBe(2);
  });

  it('has nothing to show when the gallery is empty', () => {
    expect(pageAfterDelete(0, 0)).toBeNull();
  });
});
