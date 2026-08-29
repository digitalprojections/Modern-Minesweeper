// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ADMOB_ANDROID_INTERSTITIAL_ID,
  ADMOB_TEST_INTERSTITIAL_ID,
  getInterstitialOptions,
  initializeInterstitialAds,
  resetInterstitialStateForTests,
  showGameOverInterstitial,
} from './interstitialAds';

const nativeAndroid = {
  getPlatform: () => 'android',
  isNativePlatform: () => true,
};

const webPlatform = {
  getPlatform: () => 'web',
  isNativePlatform: () => false,
};

function createAdMobAdapter() {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    prepareInterstitial: vi.fn().mockResolvedValue({ adId: ADMOB_TEST_INTERSTITIAL_ID }),
    showInterstitial: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  };
}

describe('interstitial ads', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetInterstitialStateForTests();
  });

  it('uses the supplied production interstitial when test ads are disabled', () => {
    vi.stubEnv('VITE_ADMOB_TEST_ADS', 'false');

    expect(getInterstitialOptions()).toMatchObject({
      adId: ADMOB_ANDROID_INTERSTITIAL_ID,
      isTesting: false,
      immersiveMode: true,
    });
  });

  it('defaults to Google test interstitials to keep USB testing safe', () => {
    expect(getInterstitialOptions()).toMatchObject({
      adId: ADMOB_TEST_INTERSTITIAL_ID,
      isTesting: true,
    });
  });

  it('does not initialize AdMob on web', async () => {
    const adapter = createAdMobAdapter();

    await initializeInterstitialAds(adapter, webPlatform);
    await showGameOverInterstitial(adapter, webPlatform);

    expect(adapter.initialize).not.toHaveBeenCalled();
    expect(adapter.prepareInterstitial).not.toHaveBeenCalled();
    expect(adapter.showInterstitial).not.toHaveBeenCalled();
  });

  it('prepares and shows an Android interstitial at game-over transitions', async () => {
    const adapter = createAdMobAdapter();

    await showGameOverInterstitial(adapter, nativeAndroid);

    expect(adapter.initialize).toHaveBeenCalledTimes(1);
    expect(adapter.prepareInterstitial).toHaveBeenCalledWith(expect.objectContaining({
      adId: ADMOB_TEST_INTERSTITIAL_ID,
    }));
    expect(adapter.showInterstitial).toHaveBeenCalledTimes(1);
  });
});
