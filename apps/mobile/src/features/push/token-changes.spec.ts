import { onTokenChange, single } from './token-changes';

describe('onTokenChange', () => {
  // The loop: every registration made iOS report the same token again.
  it('ignores the same token reported again', () => {
    const changed = jest.fn();
    const listener = onTokenChange(changed);
    listener('apns-1');
    listener('apns-1');
    listener('apns-1');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('passes on a token that actually rotated', () => {
    const changed = jest.fn();
    const listener = onTokenChange(changed);
    listener('apns-1');
    listener('apns-2');
    listener('apns-2');
    expect(changed.mock.calls).toEqual([['apns-1'], ['apns-2']]);
  });
});

describe('single', () => {
  it('shares one run between overlapping calls', async () => {
    let finish!: () => void;
    const job = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const run = single(job);
    const first = run();
    const second = run();
    expect(job).toHaveBeenCalledTimes(1);
    finish();
    await Promise.all([first, second]);
  });

  it('runs again once the previous run has settled, even after a failure', async () => {
    const job = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const run = single(job);
    await expect(run()).rejects.toThrow('offline');
    await expect(run()).resolves.toBeUndefined();
    expect(job).toHaveBeenCalledTimes(2);
  });
});
