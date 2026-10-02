import { reachableStorageUrl } from './storage-url';

const LAN = 'http://192.168.1.10:54321';
const signed =
  'http://127.0.0.1:54321/storage/v1/object/upload/sign/attachments/b1/u/mix.wav?token=abc.def';

describe('reachableStorageUrl', () => {
  it('moves a loopback URL onto the LAN host, keeping path and token', () => {
    expect(reachableStorageUrl(signed, LAN)).toBe(
      'http://192.168.1.10:54321/storage/v1/object/upload/sign/attachments/b1/u/mix.wav?token=abc.def',
    );
  });

  it.each(['localhost', '0.0.0.0', '[::1]'])('treats %s as loopback', (host) => {
    const url = `http://${host}:54321/storage/v1/x?token=t`;
    expect(reachableStorageUrl(url, LAN)).toBe(
      'http://192.168.1.10:54321/storage/v1/x?token=t',
    );
  });

  // A deployed API signs with the public project URL; that must be left alone.
  it('leaves a public URL untouched', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/sign/attachments/x?token=t';
    expect(reachableStorageUrl(url, LAN)).toBe(url);
  });

  it('takes the protocol from the reachable URL too', () => {
    expect(
      reachableStorageUrl('http://127.0.0.1:54321/a?token=t', 'https://tunnel.example'),
    ).toBe('https://tunnel.example/a?token=t');
  });
});
