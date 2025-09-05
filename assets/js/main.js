import { initNav } from './nav.js';
import { copyTillNumber, copyMpesaNumber } from './clipboard.js';

// Initialize site features
initNav();

// Expose functions used by inline HTML attributes
// This preserves current onclick handlers in index.html
window.copyTillNumber = copyTillNumber;
window.copyMpesaNumber = copyMpesaNumber;

// Register Service Worker for PWA (ignore errors in non-HTTPS or file:// contexts)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      // If there's an updated SW waiting, activate immediately
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      // If a new SW is installing, prompt it to activate when installed
      if (reg.installing) {
        reg.installing.addEventListener('statechange', (e) => {
          if (e.target && e.target.state === 'installed' && reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
      // Listen for updates found in the future
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(() => {});
    // When the SW takes control, reload to ensure fresh assets
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return; // avoid loops
      reloaded = true;
      window.location.reload();
    });
  });
}
