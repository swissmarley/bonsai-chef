import { api } from './api';

export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export type PushState = 'unsupported' | 'ios-needs-install' | 'denied' | 'off' | 'on';

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return 'serviceWorker' in navigator ? navigator.serviceWorker.getRegistration() : undefined;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'ios-needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/** Asks permission (must run from a user gesture) and registers this device for reminders. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) {
    throw new Error(
      isIos() && !isStandalone()
        ? 'Su iPhone e iPad aggiungi prima Bonsai Chef alla schermata Home (Condividi → «Aggiungi alla schermata Home»).'
        : 'Questo browser non supporta le notifiche push.',
    );
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permesso per le notifiche negato. Puoi riattivarlo dalle impostazioni del browser.');
  }
  const reg = await registration();
  if (!reg) throw new Error("Le notifiche sono disponibili solo nell'app installata o nella versione pubblicata.");
  const key = base64UrlToBytes(await api.pushPublicKey());
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe(); // server keys changed: re-subscribe
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api.pushSubscribe(sub.toJSON());
}

/** Re-links this device's existing push subscription to the signed-in account (e.g. after switching user). */
export async function syncPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const sub = await (await registration())?.pushManager.getSubscription();
  if (sub) await api.pushSubscribe(sub.toJSON());
}

export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.pushUnsubscribe(sub.endpoint).catch(() => {});
  await sub.unsubscribe();
}
