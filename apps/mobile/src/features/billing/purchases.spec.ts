import { showPaywall } from './purchases';

const getOfferings = jest.fn();
const getCustomerInfo = jest.fn();
const presentPaywall = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getAppUserID: jest.fn(async () => 'user-1'),
    getOfferings: (...args: unknown[]) => getOfferings(...args),
    getCustomerInfo: (...args: unknown[]) => getCustomerInfo(...args),
  },
  INTRO_ELIGIBILITY_STATUS: {},
  PURCHASES_ERROR_CODE: {},
}));
jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: { presentPaywall: (...args: unknown[]) => presentPaywall(...args) },
  PAYWALL_RESULT: {
    NOT_PRESENTED: 'NOT_PRESENTED',
    ERROR: 'ERROR',
    CANCELLED: 'CANCELLED',
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
  },
}));
jest.mock('@/lib/env', () => ({ env: { revenueCatKey: 'test_key' } }), { virtual: true });

const offering = { identifier: 'default' };

describe('showPaywall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOfferings.mockResolvedValue({ current: offering });
  });

  it('opens the current offering', async () => {
    presentPaywall.mockResolvedValue('PURCHASED');
    await expect(showPaywall('user-1')).resolves.toBe('subscribed');
    expect(presentPaywall).toHaveBeenCalledWith({ offering });
  });

  it('counts closing it as closed', async () => {
    presentPaywall.mockResolvedValue('CANCELLED');
    await expect(showPaywall('user-1')).resolves.toBe('closed');
  });

  it('only counts a restore that brought the subscription back', async () => {
    presentPaywall.mockResolvedValue('RESTORED');
    getCustomerInfo.mockResolvedValueOnce({ entitlements: { active: { band_wall: {} } } });
    await expect(showPaywall('user-1')).resolves.toBe('subscribed');
    getCustomerInfo.mockResolvedValueOnce({ entitlements: { active: {} } });
    await expect(showPaywall('user-1')).resolves.toBe('closed');
  });

  it.each(['ERROR', 'NOT_PRESENTED'])('falls back on %s', async (result) => {
    presentPaywall.mockResolvedValue(result);
    await expect(showPaywall('user-1')).resolves.toBe('unavailable');
  });

  it('falls back when there is no offering', async () => {
    getOfferings.mockResolvedValue({ current: null });
    await expect(showPaywall('user-1')).resolves.toBe('unavailable');
    expect(presentPaywall).not.toHaveBeenCalled();
  });
});
