// Clipboard utilities for copying till numbers with visual feedback
function applyButtonFeedback(buttonSelector) {
  const btn = document.querySelector(buttonSelector);
  if (!btn) return;
  const original = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check"></i>';
  btn.style.background = 'linear-gradient(135deg, #60a5fa 60%, #2563eb 100%)';
  setTimeout(() => {
    btn.innerHTML = original;
    btn.style.background = '';
  }, 1200);
}

export function copyTillNumber() {
  const numberEl = document.querySelector('.till-number');
  const number = numberEl ? numberEl.textContent.trim() : '';
  if (!number) return;
  navigator.clipboard.writeText(number).then(() => {
    applyButtonFeedback('.copy-till-btn');
  });
}

export function copyMpesaNumber() {
  const numberEl = document.querySelector('.mpesa-number');
  const number = numberEl ? numberEl.textContent.trim() : '';
  if (!number) return;
  navigator.clipboard.writeText(number).then(() => {
    applyButtonFeedback('.mpesa-copy-btn');
  });
}
