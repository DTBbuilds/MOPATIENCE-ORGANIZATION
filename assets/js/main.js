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

// Enhance Contact Cards: click, keyboard, and ripple effect
function initContactCards() {
  const cards = Array.from(document.querySelectorAll('.contact-card'));
  cards.forEach((card) => {
    // Add accessibility
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');

    // Inject ripple layer once
    if (!card.querySelector('.ripple')) {
      const rip = document.createElement('span');
      rip.className = 'ripple';
      card.appendChild(rip);
    }

    // Navigate helper: prefer inner anchor if present
    function navigate() {
      const a = card.querySelector('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      const target = a.getAttribute('target');
      if (target === '_blank') {
        window.open(href, '_blank', 'noopener');
      } else {
        window.location.href = href;
      }
    }

    // Ripple helper
    function rippleAt(x, y) {
      const rip = card.querySelector('.ripple');
      if (!rip) return;
      const rect = card.getBoundingClientRect();
      const rx = ((x - rect.left) / rect.width) * 100;
      const ry = ((y - rect.top) / rect.height) * 100;
      rip.style.setProperty('--rx', `${rx}%`);
      rip.style.setProperty('--ry', `${ry}%`);
      card.classList.add('rippling');
      // Respect reduced motion
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dur = prefersReduced ? 150 : 450;
      setTimeout(() => card.classList.remove('rippling'), dur);
    }

    // Click handler (avoid double navigation if inner anchor clicked)
    card.addEventListener('click', (e) => {
      const isAnchor = (e.target instanceof Element) && !!e.target.closest('a');
      rippleAt(e.clientX, e.clientY);
      if (!isAnchor) navigate();
    });

    // Keyboard support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const rect = card.getBoundingClientRect();
        rippleAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
        navigate();
      }
    });
  });
}

// Initialize enhancements on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initContactCards();
  initIconNavLinks();
});

// Icon-only navbar links: reveal label on first interaction
function initIconNavLinks() {
  const nav = document.querySelector('.navbar .nav-links');
  if (!nav) return;
  const links = Array.from(nav.querySelectorAll('a'));

  function isCompact() {
    return window.matchMedia('(min-width: 901px)').matches; // icon-only on wider screens
  }

  // CSS handles hover/focus reveal on wide screens. We only ensure labels are shown on small screens.
  function syncForViewport() {
    if (isCompact()) {
      // Wide screens: icon-only by default; let CSS reveal on hover/focus
      links.forEach((a) => a.classList.remove('show-label'));
    } else {
      // Small screens: always show labels
      links.forEach((a) => a.classList.add('show-label'));
    }
  }
  window.addEventListener('resize', syncForViewport);
  syncForViewport();
}
