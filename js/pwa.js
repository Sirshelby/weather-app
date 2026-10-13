// Service worker registration, custom install button, and online/offline notices.
import { toast } from './ui.js';

export function initPWA() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        // When an updated worker takes over, offer a refresh.
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          next?.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              toast('A new version is available — reload to update.', 6000);
            }
          });
        });
      }).catch(() => { /* non-fatal */ });
    });
  }

  const btn = document.getElementById('install-btn');
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });

  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    btn.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    toast('Weather Now was installed.');
  });

  window.addEventListener('offline', () => toast('You’re offline — showing the last saved forecast.', 5000));
  window.addEventListener('online', () => toast('Back online.'));
}
