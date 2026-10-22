import { urlOnDevHost } from './dev-host';

describe('urlOnDevHost', () => {
  it('puts the port on the host Metro was opened at', () => {
    expect(urlOnDevHost('172.20.10.2:8081', 3001)).toBe('http://172.20.10.2:3001');
  });

  it('keeps an IPv6 host bracketed', () => {
    expect(urlOnDevHost('[fe80::1]:8081', 54321)).toBe('http://[fe80::1]:54321');
  });

  it('tolerates a scheme or a path on the Metro URL', () => {
    expect(urlOnDevHost('http://192.168.1.10:8081/index', 3001)).toBe('http://192.168.1.10:3001');
  });

  it('has nothing to offer without a Metro host', () => {
    expect(urlOnDevHost(undefined, 3001)).toBeUndefined();
    expect(urlOnDevHost('', 3001)).toBeUndefined();
  });
});
