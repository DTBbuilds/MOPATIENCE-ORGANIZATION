// Navigation (mobile menu) toggle with ARIA updates
export function initNav() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (!menuToggle || !navLinks) return;

  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    navLinks.classList.toggle('open');
  });

  // Close menu when a link is clicked (mobile UX)
  navLinks.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.tagName === 'A') {
      const href = target.getAttribute('href') || '';
      const isHashLink = href.startsWith('#');

      // Always close the mobile menu
      navLinks.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');

      // For in-page anchors, handle smooth scrolling after menu closes
      if (isHashLink) {
        const id = href.slice(1);
        const el = document.getElementById(id);
        if (el) {
          e.preventDefault();
          // Delay to ensure layout updates after menu closes
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Improve accessibility: move focus to the target without jumping
            el.setAttribute('tabindex', '-1');
            el.focus({ preventScroll: true });
            // Update URL hash without triggering a jump
            history.pushState(null, '', href);
          }, 50);
        }
      }
    }
  });
}
