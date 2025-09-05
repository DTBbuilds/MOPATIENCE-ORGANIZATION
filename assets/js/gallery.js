// Vanilla JS gallery slider for per-card carousels
// Each gallery card should have structure:
// <div class="visit-card" data-gallery-id="aic-kathonzweni">
//   <div class="slider" role="region" aria-roledescription="carousel" aria-label="AIC Kathonzweni photos">
//     <div class="slides">
//       <img src="..." alt="..." class="slide is-active" loading="lazy" decoding="async">
//       <img src="..." alt="..." class="slide" loading="lazy" decoding="async">
//     </div>
//     <button class="prev" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>
//     <button class="next" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>
//     <div class="dots" role="tablist"></div>
//   </div>
// </div>

// Init gallery sliders (module scope)
(function() {
  // Lightbox module (outer scope so sliders can call it)
  // Global lightbox singleton to prevent duplicates
  if (window.galleryLightbox) return;
  
  const lb = {
    el: null, img: null, caption: null, thumbs: null,
    btnPrev: null, btnNext: null, btnClose: null, backdrop: null,
    slides: [], index: 0, open: false, root: null, _wired: false,
    thumbButtons: [], preloadedImages: new Set()
  };
  
  window.galleryLightbox = lb;

  function updateLightbox() {
    if (!lb.open || !lb.slides.length) return;
    const s = lb.slides[lb.index];
    lb.img.src = s.src;
    lb.img.alt = s.alt || '';
    lb.caption.textContent = s.alt || '';
    
    // Preload neighbors only if not already preloaded
    const prevIdx = (lb.index - 1 + lb.slides.length) % lb.slides.length;
    const nextIdx = (lb.index + 1) % lb.slides.length;
    [prevIdx, nextIdx].forEach((i) => {
      const src = lb.slides[i].src;
      if (!lb.preloadedImages.has(src)) {
        const pre = new Image();
        pre.decoding = 'async';
        pre.loading = 'eager';
        pre.src = src;
        lb.preloadedImages.add(src);
      }
    });
    
    // Thumbnail updates disabled
  }

  function openLightboxFromSlider(sliderRoot, startIndex) {
    if (!lb._wired) return; // not ready yet
    const imgs = Array.from(sliderRoot.querySelectorAll('.slide'));
    if (!imgs.length) return;
    lb.slides = imgs.map(img => ({ src: img.currentSrc || img.getAttribute('src'), alt: img.getAttribute('alt') }));
    lb.index = Math.max(0, Math.min(startIndex || 0, lb.slides.length - 1));
    lb.root = sliderRoot;
    
    // Thumbnails disabled - no longer creating thumbnail elements
    
    lb.el.classList.add('open');
    lb.el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lb.open = true;
    updateLightbox();
    const content = lb.el.querySelector('.lightbox-content');
    content && content.focus();
  }

  function closeLightbox() {
    lb.open = false;
    if (!lb.el) return;
    lb.el.classList.remove('open');
    lb.el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    
    // Clear state and cache
    lb.slides = [];
    lb.thumbButtons = [];
    lb.preloadedImages.clear();
    lb.root = null;
    // Thumbnail cleanup disabled
  }

  function nextLightbox(delta) {
    if (!lb.open || !lb.slides.length) return;
    const len = lb.slides.length;
    lb.index = (lb.index + (delta || 1) + len) % len;
    updateLightbox();
  }

  function setupLightbox() {
    // Prevent multiple setups
    if (lb._wired) return;
    
    // Cache DOM refs
    lb.el = document.getElementById('lightbox');
    if (!lb.el) return;
    lb.img = document.querySelector('#lightbox .lightbox-image');
    lb.caption = document.querySelector('#lightbox .lightbox-caption');
    // lb.thumbs = document.querySelector('#lightbox .lightbox-thumbs'); // Disabled
    lb.btnPrev = document.querySelector('#lightbox .lightbox-prev');
    lb.btnNext = document.querySelector('#lightbox .lightbox-next');
    lb.btnClose = document.querySelector('#lightbox [data-close]');
    lb.backdrop = document.querySelector('#lightbox .lightbox-backdrop');

    // Wire events once
    if (lb.btnPrev) lb.btnPrev.addEventListener('click', () => nextLightbox(-1));
    if (lb.btnNext) lb.btnNext.addEventListener('click', () => nextLightbox(1));
    if (lb.btnClose) lb.btnClose.addEventListener('click', closeLightbox);
    if (lb.backdrop) lb.backdrop.addEventListener('click', closeLightbox);
    
    // Additional close button selector fallback
    const closeBtn = document.querySelector('#lightbox .lightbox-close');
    if (closeBtn && closeBtn !== lb.btnClose) {
      closeBtn.addEventListener('click', closeLightbox);
    }
    document.addEventListener('keydown', (e) => {
      if (!lb.open) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') nextLightbox(-1);
      if (e.key === 'ArrowRight') nextLightbox(1);
    });
    lb._wired = true;
  }
  async function fetchCaptions(folder) {
    try {
      const res = await fetch(`${folder}/captions.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return {};
      const data = await res.json();
      return data || {};
    } catch (_) {
      return {};
    }
  }

  async function fetchImagesManifest(folder) {
    try {
      const res = await fetch(`${folder}/images.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data)) return data; // ["photoA.jpg", "kids.png", ...]
      if (data && Array.isArray(data.images)) return data.images; // { images: [ ... ] }
      return null;
    } catch (_) {
      return null;
    }
  }

  function preloadFirstExisting(folder, base, i, exts) {
    return new Promise((resolve) => {
      let idx = 0;
      function tryNext() {
        if (idx >= exts.length) { resolve(null); return; }
        const url = `${folder}/${base}-${i}.${exts[idx]}`;
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => { idx += 1; tryNext(); };
        img.src = url;
      }
      tryNext();
    });
  }

  function preloadFirstExistingByBases(folder, bases, i, exts) {
    return new Promise((resolve) => {
      let bIdx = 0;
      let eIdx = 0;
      function tryNext() {
        if (bIdx >= bases.length) { resolve(null); return; }
        const url = `${folder}/${bases[bIdx]}-${i}.${exts[eIdx]}`;
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => {
          eIdx += 1;
          if (eIdx >= exts.length) { eIdx = 0; bIdx += 1; }
          tryNext();
        };
        img.src = url;
      }
      tryNext();
    });
  }

  async function buildSlidesChunk(root, startIndex, chunkSize) {
    // Populate slides from {folder}/{base}-{n}.{jpg|png} for n in [startIndex+1 ... startIndex+chunkSize]
    const slidesWrap = root.querySelector('.slides');
    if (!slidesWrap) return { added: 0, lastIndex: startIndex };
    const folder = root.getAttribute('data-folder');
    const base = root.getAttribute('data-base') || 'img';
    const ext = root.getAttribute('data-ext') || 'jpg'; // kept for backward compatibility
    const allowFallback = root.getAttribute('data-allow-fallback') !== '0';
    let max = parseInt(root.getAttribute('data-max') || '50', 10);
    const aria = root.getAttribute('aria-label') || 'Gallery photos';
    if (!folder) return { added: 0, lastIndex: startIndex };

    // Cache captions on the root element dataset
    if (!root._captions) {
      root._captions = await fetchCaptions(folder);
    }

    // Prefer a manifest of arbitrary filenames if present
    if (!root._manifest) {
      root._manifest = await fetchImagesManifest(folder);
    }

    // If we have a manifest, use it directly
    if (Array.isArray(root._manifest) && root._manifest.length > 0) {
      max = root._manifest.length;
      let added = 0;
      let lastIndex = startIndex;
      const targetEnd = Math.min(startIndex + chunkSize, max);
      for (let i = startIndex + 1; i <= targetEnd; i++) {
        const entry = root._manifest[i - 1]; // 1-based index
        if (!entry) { lastIndex = i; continue; }
        // Support object entries: { src, srcset, sizes, alt }
        if (typeof entry === 'object' && entry.src) {
          const srcUrl = entry.src.startsWith('http') ? entry.src : `${folder}/${entry.src}`;
          const el = document.createElement('img');
          el.className = 'slide' + (slidesWrap.children.length === 0 ? ' is-active' : '');
          el.src = srcUrl;
          if (entry.srcset) {
            const normalizeOne = (token) => {
              const t = String(token).trim();
              if (!t) return '';
              const spaceIdx = t.indexOf(' ');
              const urlPart = spaceIdx === -1 ? t : t.slice(0, spaceIdx);
              const descPart = spaceIdx === -1 ? '' : t.slice(spaceIdx);
              // If urlPart is absolute (http(s)) or root-relative (/), keep as-is; else prefix folder
              const normalizedUrl = (/^https?:\/\//i.test(urlPart) || urlPart.startsWith('/'))
                ? urlPart
                : `${folder}/${urlPart}`;
              return `${normalizedUrl}${descPart}`;
            };
            if (Array.isArray(entry.srcset)) {
              el.srcset = entry.srcset.map(normalizeOne).filter(Boolean).join(', ');
            } else {
              // split by comma, normalize each candidate
              el.srcset = String(entry.srcset)
                .split(',')
                .map(normalizeOne)
                .filter(Boolean)
                .join(', ');
            }
          }
          el.sizes = entry.sizes || '(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw';
          const caption = entry.alt || root._captions?.[i] || root._captions?.[entry.src] || `${aria} ${i}`;
          el.alt = caption;
          el.loading = 'lazy';
          el.decoding = 'async';
          // Set default dimensions to reduce CLS (matches CSS 16:9 area)
          el.width = 1600;
          el.height = 900;
          // Refine to natural dimensions after load
          el.addEventListener('load', function onLoad() {
            try {
              if (this.naturalWidth && this.naturalHeight) {
                this.width = this.naturalWidth;
                this.height = this.naturalHeight;
              }
            } catch (_) { /* ignore */ }
            this.removeEventListener('load', onLoad);
          });
          if (slidesWrap.children.length === 0) {
            el.setAttribute('fetchpriority', 'high');
          }
          slidesWrap.appendChild(el);
          added += 1;
          lastIndex = i;
          continue;
        }

        const fileName = String(entry);
        const originalUrl = `${folder}/${fileName}`;
        // Try a .webp variant first if the original isn't already webp
        const tryUrls = [];
        if (!/\.webp$/i.test(fileName)) {
          const base = fileName.replace(/\.[^.]+$/, '');
          tryUrls.push(`${folder}/${base}.webp`);
        }
        tryUrls.push(originalUrl);
        // eslint-disable-next-line no-await-in-loop
        const chosenUrl = await new Promise((resolve) => {
          let idx = 0;
          const testNext = () => {
            if (idx >= tryUrls.length) { resolve(null); return; }
            const u = tryUrls[idx++];
            const tester = new Image();
            tester.onload = () => resolve(u);
            tester.onerror = () => testNext();
            tester.src = u;
          };
          testNext();
        });
        if (chosenUrl) {
          const el = document.createElement('img');
          el.className = 'slide' + (slidesWrap.children.length === 0 ? ' is-active' : '');
          el.src = chosenUrl;
          const caption = root._captions?.[i] || root._captions?.[fileName] || `${aria} ${i}`;
          el.alt = caption;
          el.loading = 'lazy';
          el.decoding = 'async';
          el.sizes = '(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw';
          // Set default dimensions to reduce CLS (matches CSS 16:9 area)
          el.width = 1600;
          el.height = 900;
          // Refine to natural dimensions after load
          el.addEventListener('load', function onLoad() {
            try {
              if (this.naturalWidth && this.naturalHeight) {
                this.width = this.naturalWidth;
                this.height = this.naturalHeight;
              }
            } catch (_) { /* ignore */ }
            this.removeEventListener('load', onLoad);
          });
          if (slidesWrap.children.length === 0) {
            el.setAttribute('fetchpriority', 'high');
          }
          slidesWrap.appendChild(el);
          added += 1;
        }
        lastIndex = i;
      }
      // Update an effective max on root for counters
      root._effectiveMax = max;
      return { added, lastIndex };
    }

    // If fallback probing is disabled, stop here before attempting any guesses
    if (!allowFallback) {
      root._effectiveMax = 0;
      return { added: 0, lastIndex: startIndex };
    }

    const exts = ['jpg', 'jpeg', 'png', 'webp'];
    if (ext && !exts.includes(ext)) exts.unshift(ext);
    const bases = [base, 'Image', 'image', 'IMG', 'Img', 'PICTURE', 'Picture', 'picture', 'Photo', 'photo'];

    let added = 0;
    let lastIndex = startIndex;
    const targetEnd = Math.min(startIndex + chunkSize, max);

    for (let i = startIndex + 1; i <= targetEnd; i++) {
      // eslint-disable-next-line no-await-in-loop
      const url = await preloadFirstExistingByBases(folder, bases, i, exts);
      if (url) {
        const el = document.createElement('img');
        el.className = 'slide' + (slidesWrap.children.length === 0 ? ' is-active' : '');
        el.src = url;
        const caption = root._captions?.[i] || `${aria} ${i}`;
        el.alt = caption;
        el.loading = 'lazy';
        el.decoding = 'async';
        el.sizes = '(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw';
        // Set default dimensions to reduce CLS (matches CSS 16:9 area)
        el.width = 1600;
        el.height = 900;
        // Refine to natural dimensions after load
        el.addEventListener('load', function onLoad() {
          try {
            if (this.naturalWidth && this.naturalHeight) {
              this.width = this.naturalWidth;
              this.height = this.naturalHeight;
            }
          } catch (_) { /* ignore */ }
          this.removeEventListener('load', onLoad);
        });
        if (slidesWrap.children.length === 0) {
          el.setAttribute('fetchpriority', 'high');
        }
        slidesWrap.appendChild(el);
        added += 1;
        lastIndex = i;
      } else {
        lastIndex = i;
      }
    }
    // Update an effective max for counters
    root._effectiveMax = max;
    return { added, lastIndex };
  }

  async function initSlider(root) {
    // If no slides present (HTML uses data-attrs), build them dynamically
    let slides = Array.from(root.querySelectorAll('.slide'));
    const initialChunk = 9;
    root._lastLoadedIndex = 0;
    if (slides.length === 0) {
      const res = await buildSlidesChunk(root, 0, initialChunk);
      root._lastLoadedIndex = res.lastIndex;
      slides = Array.from(root.querySelectorAll('.slide'));
      if (slides.length === 0) {
        // Render a visible message if no photos found
        const msg = document.createElement('div');
        msg.className = 'no-photos';
        msg.textContent = 'No photos found';
        const slidesWrap = root.querySelector('.slides');
        slidesWrap && slidesWrap.appendChild(msg);
        // Hide controls
        const prev = root.querySelector('.prev');
        const next = root.querySelector('.next');
        const dots = root.querySelector('.dots');
        if (prev) prev.style.display = 'none';
        if (next) next.style.display = 'none';
        if (dots) dots.style.display = 'none';
        // Also avoid adding external controls for empty sliders
        return;
      }
    }

    const prevBtn = root.querySelector('.prev');
    const nextBtn = root.querySelector('.next');
    const dots = root.querySelector('.dots');
    let index = Math.max(0, slides.findIndex(s => s.classList.contains('is-active')));

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, idx) => {
        s.classList.toggle('is-active', idx === index);
        s.setAttribute('aria-hidden', idx === index ? 'false' : 'true');
      });
      if (dots) {
        Array.from(dots.children).forEach((d, idx) => {
          d.classList.toggle('active', idx === index);
          d.setAttribute('aria-selected', idx === index ? 'true' : 'false');
        });
      }
      // Preload adjacent slides for smoother navigation
      const prevIdx = (index - 1 + slides.length) % slides.length;
      const nextIdx = (index + 1) % slides.length;
      [prevIdx, nextIdx].forEach((pi) => {
        const s = slides[pi];
        if (s && s.tagName === 'IMG') {
          const pre = new Image();
          pre.decoding = 'async';
          pre.loading = 'eager';
          pre.src = s.getAttribute('src');
        }
      });
    }

    function rebuildDots() {
      if (!dots) return;
      dots.innerHTML = '';
      slides.forEach((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dot' + (i === index ? ' active' : '');
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', i === index ? 'true' : 'false');
        b.setAttribute('aria-label', `Go to image ${i + 1}`);
        b.addEventListener('click', () => show(i));
        dots.appendChild(b);
      });
    }
    rebuildDots();

    prevBtn && prevBtn.addEventListener('click', () => show(index - 1));
    nextBtn && nextBtn.addEventListener('click', () => show(index + 1));

    // Keyboard support within slider
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { show(index - 1); }
      if (e.key === 'ArrowRight') { show(index + 1); }
    });

    // Mouse wheel navigation (desktop): scroll left/right to change image
    root.addEventListener('wheel', (e) => {
      // Only act when user scrolls horizontally or with ctrlKey on some devices
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 5) return; // ignore very small
      e.preventDefault();
      if (delta > 0) show(index + 1); else show(index - 1);
    }, { passive: false });

    // Drag/Swipe navigation (pointer events)
    const slidesContainer = root.querySelector('.slides');
    let isDown = false;
    let startX = 0;
    let moved = 0;

    function pointerDown(clientX) {
      isDown = true;
      startX = clientX;
      moved = 0;
      root.classList.add('dragging');
    }
    function pointerMove(clientX) {
      if (!isDown) return;
      moved = clientX - startX;
      // Optional: could add transform preview here
    }
    function pointerUp() {
      if (!isDown) return;
      root.classList.remove('dragging');
      isDown = false;
      if (Math.abs(moved) > 40) {
        if (moved < 0) show(index + 1); else show(index - 1);
      }
    }

    // Mouse
    slidesContainer.addEventListener('mousedown', (e) => pointerDown(e.clientX));
    window.addEventListener('mousemove', (e) => pointerMove(e.clientX));
    window.addEventListener('mouseup', pointerUp);

    // Touch
    slidesContainer.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) pointerDown(e.touches[0].clientX);
    }, { passive: true });
    slidesContainer.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) pointerMove(e.touches[0].clientX);
    }, { passive: true });
    slidesContainer.addEventListener('touchend', pointerUp, { passive: true });

    // Initialize visible state
    show(index);

    // Event delegation so late-added slides open lightbox
    root.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!t.classList.contains('slide')) return;
      openLightboxFromSlider(root, Array.from(root.querySelectorAll('.slide')).indexOf(t));
    });

    // Consolidated control: single 'View photos' button
    const folder = root.getAttribute('data-folder');
    function getMax() {
      return root._effectiveMax || parseInt(root.getAttribute('data-max') || '50', 10);
    }
    const controlsWrap = document.createElement('div');
    controlsWrap.style.display = 'flex';
    controlsWrap.style.justifyContent = 'center';
    controlsWrap.style.marginTop = '0.5rem';
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'btn primary view-photos-btn';
    viewBtn.textContent = 'View photos';
    viewBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      // Ensure all photos are loaded so lightbox can navigate fully
      let last = root._lastLoadedIndex || 0;
      const max = getMax();
      while (last < max) {
        // Load in chunks of 12 to avoid blocking UI too long
        // eslint-disable-next-line no-await-in-loop
        const res = await buildSlidesChunk(root, last, 12);
        if (res.added > 0) {
          root._lastLoadedIndex = res.lastIndex;
          last = res.lastIndex;
        } else {
          break;
        }
      }
      slides = Array.from(root.querySelectorAll('.slide'));
      rebuildDots();
      show(index);
      const slidesNow = slides;
      if (slidesNow.length === 0) return;
      const activeIdx = Math.max(0, slidesNow.findIndex(s => s.classList.contains('is-active')));
      openLightboxFromSlider(root, activeIdx);
    });
    controlsWrap.appendChild(viewBtn);
    const afterSlider = root.parentElement;
    if (afterSlider) afterSlider.appendChild(controlsWrap);

  } // end initSlider
  function initAfterLoad() {
    // Prepare lightbox once before any slider initialization
    setupLightbox();
    
    // Lazy-initialize sliders when they enter the viewport
    const sliders = Array.from(document.querySelectorAll('.slider'));
    function ensureInit(slider){
      if (slider && !slider.dataset.initialized) {
        slider.dataset.initialized = '1';
        initSlider(slider);
      }
    }
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            ensureInit(entry.target);
            obs.unobserve(entry.target);
          }
        });
      }, { rootMargin: '200px 0px' });
      sliders.forEach((s) => io.observe(s));
    } else {
      sliders.forEach((s) => ensureInit(s));
    }

    // Cursor for slides (including dynamically added)
    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (t instanceof Element && t.classList.contains('slide')) {
        t.style.cursor = 'zoom-in';
      }
    });

    // Visits horizontal carousel controls
    const wrap = document.querySelector('.visits-carousel-wrap');
    if (wrap) {
      const grid = wrap.querySelector('.visits-grid.carousel');
      const prev = wrap.querySelector('.visits-nav.prev');
      const next = wrap.querySelector('.visits-nav.next');
      if (grid && prev && next) {
        function updateNav() {
          const maxScroll = grid.scrollWidth - grid.clientWidth;
          prev.disabled = grid.scrollLeft <= 0;
          next.disabled = grid.scrollLeft >= (maxScroll - 1);
        }
        function scrollByCard(dir) {
          const card = grid.querySelector('.visit-card');
          const gap = 16; // approx 1rem gap from CSS
          const amount = card ? card.getBoundingClientRect().width + gap : grid.clientWidth * 0.9;
          grid.scrollBy({ left: dir * amount, behavior: 'smooth' });
          setTimeout(updateNav, 350);
        }
        prev.addEventListener('click', () => scrollByCard(-1));
        next.addEventListener('click', () => scrollByCard(1));
        grid.addEventListener('scroll', updateNav, { passive: true });
        window.addEventListener('resize', updateNav);
        // Initial state
        setTimeout(updateNav, 0);
      }
    }
  }

  // Wait for stylesheets to load (with timeout) to avoid early layout before CSS is applied
  function waitForStylesheetsLoaded(timeout = 3000) {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    if (!links.length) return Promise.resolve();
    return new Promise((resolve) => {
      let done = 0;
      let settled = false;
      const total = links.length;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const check = () => {
        done += 1;
        if (done >= total) finish();
      };
      const timer = setTimeout(finish, timeout);
      links.forEach((link) => {
        // If stylesheet already parsed, resolve this one
        if (link.sheet) { check(); return; }
        link.addEventListener('load', check, { once: true });
        link.addEventListener('error', check, { once: true });
      });
    });
  }

  // Defer gallery initialization until after full window load, then after stylesheets
  function startWhenReady() {
    waitForStylesheetsLoaded().then(() => requestAnimationFrame(initAfterLoad));
  }

  if (document.readyState === 'complete') {
    startWhenReady();
  } else {
    window.addEventListener('load', startWhenReady, { once: true });
  }
})();
