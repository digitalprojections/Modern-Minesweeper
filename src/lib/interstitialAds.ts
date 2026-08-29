import { AdMob, InterstitialAdPluginEvents, type AdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export const ADMOB_ANDROID_INTERSTITIAL_ID = 'ca-app-pub-3838820812386239/6072644784';
export const ADMOB_TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

type NativePlatform = Pick<typeof Capacitor, 'getPlatform' | 'isNativePlatform'>;
type InterstitialAdAdapter = Pick<
  typeof AdMob,
  'initialize' | 'prepareInterstitial' | 'showInterstitial' | 'addListener'
>;

let initialized = false;
let prepared = false;
let listenersAttached = false;
let preparePromise: Promise<void> | null = null;
let showPromise: Promise<void> | null = null;

export function getInterstitialOptions(): AdOptions {
  const isTesting = import.meta.env.VITE_ADMOB_TEST_ADS !== 'false';

  return {
    adId: isTesting ? ADMOB_TEST_INTERSTITIAL_ID : ADMOB_ANDROID_INTERSTITIAL_ID,
    isTesting,
    immersiveMode: true,
  };
}

export async function initializeInterstitialAds(
  adapter: InterstitialAdAdapter = AdMob,
  platform: NativePlatform = Capacitor,
): Promise<void> {
  if (!platform.isNativePlatform() || platform.getPlatform() !== 'android') {
    return;
  }

  if (!initialized) {
    await adapter.initialize();
    initialized = true;
  }

  if (!listenersAttached) {
    await Promise.all([
      adapter.addListener(InterstitialAdPluginEvents.Loaded, () => {
        prepared = true;
      }),
      adapter.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
        prepared = false;
        preparePromise = null;
      }),
      adapter.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        prepared = false;
        preparePromise = null;
        void prepareInterstitialAd(adapter, platform);
      }),
      adapter.addListener(InterstitialAdPluginEvents.FailedToShow, () => {
        prepared = false;
        showPromise = null;
      }),
    ]);
    listenersAttached = true;
  }

  await prepareInterstitialAd(adapter, platform);
}

export async function showGameOverInterstitial(
  adapter: InterstitialAdAdapter = AdMob,
  platform: NativePlatform = Capacitor,
): Promise<void> {
  if (!platform.isNativePlatform() || platform.getPlatform() !== 'android') {
    return;
  }

  await initializeInterstitialAds(adapter, platform);
  await prepareInterstitialAd(adapter, platform);

  if (!prepared || showPromise) {
    return;
  }

  showPromise = adapter
    .showInterstitial()
    .catch(() => {
      prepared = false;
    })
    .finally(() => {
      showPromise = null;
    });

  await showPromise;
}

export function resetInterstitialStateForTests(): void {
  initialized = false;
  prepared = false;
  listenersAttached = false;
  preparePromise = null;
  showPromise = null;
}

async function prepareInterstitialAd(
  adapter: InterstitialAdAdapter,
  platform: NativePlatform,
): Promise<void> {
  if (!platform.isNativePlatform() || platform.getPlatform() !== 'android' || prepared) {
    return;
  }

  if (!preparePromise) {
    preparePromise = adapter
      .prepareInterstitial(getInterstitialOptions())
      .then(() => {
        prepared = true;
      })
      .catch(() => {
        prepared = false;
      })
      .finally(() => {
        preparePromise = null;
      });
  }

  await preparePromise;
}
