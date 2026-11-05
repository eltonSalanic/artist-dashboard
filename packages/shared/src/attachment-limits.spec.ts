import {
  attachmentSizeClass,
  attachmentSizeError,
  MAX_ATTACHMENT_BYTES,
  uploadUrlSchema,
} from './dto/attachment.dto';

const MB = 1024 * 1024;

describe('attachment size caps', () => {
  it('sorts files by type', () => {
    expect(attachmentSizeClass('image/heic')).toBe('image');
    expect(attachmentSizeClass('application/pdf')).toBe('pdf');
    expect(attachmentSizeClass('audio/wav')).toBe('audio');
    expect(attachmentSizeClass('video/mp4')).toBe('video');
    expect(attachmentSizeClass('application/zip')).toBe('other');
    expect(attachmentSizeClass('')).toBe('other');
  });

  it('caps each type at its own size', () => {
    expect(attachmentSizeError('image/jpeg', 10 * MB)).toBeNull();
    expect(attachmentSizeError('image/jpeg', 10 * MB + 1)).toBe(
      'Images can be up to 10 MB',
    );
    expect(attachmentSizeError('audio/wav', 60 * MB)).toBeNull();
    expect(attachmentSizeError('application/pdf', 30 * MB)).toBe(
      'PDFs can be up to 25 MB',
    );
  });

  it('the overall cap is the largest per-type cap', () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(100 * MB);
  });

  it('refuses an upload URL for a file over its type cap', () => {
    const result = uploadUrlSchema.safeParse({
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      size: 12 * MB,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Images can be up to 10 MB');
  });
});
