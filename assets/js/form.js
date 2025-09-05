// Enhance the contact form UX without breaking Formspree default behavior
export function enhanceContactForm() {
  const form = document.querySelector('form.contact-form');
  if (!form) return;

  // Honeypot field (hidden)
  const honeypot = document.createElement('input');
  honeypot.type = 'text';
  honeypot.name = 'website';
  honeypot.tabIndex = -1;
  honeypot.autocomplete = 'off';
  honeypot.style.position = 'absolute';
  honeypot.style.left = '-5000px';
  form.appendChild(honeypot);

  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
  const originalText = submitBtn ? (submitBtn.textContent || submitBtn.value) : '';

  form.addEventListener('submit', () => {
    if (submitBtn) {
      submitBtn.disabled = true;
      if (submitBtn.tagName === 'BUTTON') {
        submitBtn.textContent = 'Sending…';
      } else if (submitBtn.tagName === 'INPUT') {
        submitBtn.value = 'Sending…';
      }
    }
  });

  // Restore button on page show (bfcache or back nav)
  window.addEventListener('pageshow', () => {
    if (submitBtn) {
      submitBtn.disabled = false;
      if (submitBtn.tagName === 'BUTTON') {
        submitBtn.textContent = originalText;
      } else if (submitBtn.tagName === 'INPUT') {
        submitBtn.value = originalText;
      }
    }
  });
}
