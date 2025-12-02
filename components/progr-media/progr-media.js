// progr-media.js (ESM, single import for styles + template + element)
// Assumes the control template is available and injected here.
import './progr-media.css';
import ctrlTemplate from './progr-media.html?raw';

// Install the template once (required)
if (typeof document !== 'undefined' && !document.getElementById('progr-media-ctrl')) {
  const holder = document.createElement('div');
  holder.innerHTML = ctrlTemplate.trim();
  const tpl = holder.firstElementChild; // <template id="progr-media-ctrl">
  if (!tpl || tpl.tagName !== 'TEMPLATE') {
    throw new Error('[progr-media] Missing <template id="progr-media-ctrl">');
  }
  document.body.appendChild(tpl);
}

(() => {
  if (typeof window === 'undefined') return; // SSR guard
  if (customElements.get('progr-media')) return;

  const VIDEO_EXT = /\.(mp4|webm|ogg|m4v|mov)(\?|#|$)/i;
  const GIF_EXT = /\.(gif)(\?|#|$)/i;

  class ProgrMedia extends HTMLElement {
    static get observedAttributes() {
      return [
        'src-high',
        'kind',
        'eager',
        'rootmargin',
        'object-fit',
        'poster',
        'autoplay',
        'loop',
        'muted',
        'playsinline',
        'controls',
      ];
    }

    constructor() {
      super();
      this._io = null;              // lazy-load IO
      this._playIO = null;          // visibility / pause/resume IO
      this._abort = new AbortController();
      this._objectURLs = new Set();
      this._upgraded = false;

      this._gifAnimatedUrl = null;
      this._gifStillDataUrl = null;

      this._ctrl = this._createCtrlFromTemplate();

      this._externalSignal = null;
      this._mode = 'hover';         // hover | controls | autoplay | touch-controls
      this._wasPlayingOnLeave = false;

      this._hoverHandlersBound = false;
      this._onPointerEnter = null;
      this._onPointerLeave = null;

      // interactions
      this.addEventListener('click', (e) => {
        if ((e.target instanceof HTMLElement) && e.target.closest('a,.pm-ctrl')) return;
        this._togglePlay();
      });
      this._ctrl.addEventListener('click', (e) => {
        e.stopPropagation();
        this._togglePlay();
      });
      this.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          this._togglePlay();
        }
      });
      this.tabIndex = 0;
    }

    connectedCallback() {
      const low = this._findLowImg();
      if (!low) {
        throw new Error('<progr-media> requires a child <img> as the low-res preview.');
      }
      low.classList.add('pm-low');
      if (!low.parentElement || low.parentElement !== this) this.appendChild(low);

      if (this.hasAttribute('object-fit')) {
        this.style.setProperty('--pm-object-fit', this.getAttribute('object-fit'));
      }

      if (!this.contains(this._ctrl)) this.appendChild(this._ctrl);

      this._computeMode();
      this._maybeObserve();
    }

    disconnectedCallback() {
      this._cleanup();
    }

    attributeChangedCallback() {
      this._computeMode();
      if (this.isConnected && !this._upgraded) this._maybeObserve(true);
    }

    // External AbortSignal (e.g., Alpine store): el.signal = Alpine.store('modal').signal
    set signal(sig) { this._externalSignal = sig; }

    // ---- internals

    _createCtrlFromTemplate() {
      const tpl = document.getElementById('progr-media-ctrl');
      if (!tpl || !(tpl instanceof HTMLTemplateElement)) {
        throw new Error('[progr-media] <template id="progr-media-ctrl"> not found. Ensure progr-media.template.html is loaded.');
      }
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.state = 'play';
      node.setAttribute('aria-label', 'Play');
      return node;
    }

    _findLowImg() {
      const kids = Array.from(this.children).filter(n => n !== this._ctrl);
      const el = kids[0];
      if (!el) return null;
      return el.tagName === 'IMG' ? el : el.querySelector?.('img') || null;
    }

    _kind() {
      const explicit = (this.getAttribute('kind') || '').toLowerCase();
      if (explicit === 'img' || explicit === 'image') return 'img';
      if (explicit === 'video') return 'video';
      if (explicit === 'gif') return 'gif';
      const src = this.getAttribute('src-high') || '';
      if (VIDEO_EXT.test(src)) return 'video';
      if (GIF_EXT.test(src)) return 'gif';
      return 'img';
    }

    _rootMargin() { return this.getAttribute('rootmargin') || '200px 0px'; }
    _isEager() { return this.hasAttribute('eager'); }

    _computeMode() {
      let touchLike = false;
      try {
        if (typeof window !== 'undefined' && 'matchMedia' in window) {
          const mm = window.matchMedia.bind(window);
          touchLike = mm('(pointer: coarse)').matches || mm('(hover: none)').matches;
        }
      } catch {
        touchLike = false;
      }

      const wantsControls = this.hasAttribute('controls');
      const wantsAutoplay = this.hasAttribute('autoplay');

      // If autoplay is requested, enforce muted + playsinline on the host
      if (wantsAutoplay) {
        if (!this.hasAttribute('muted')) this.setAttribute('muted', '');
        if (!this.hasAttribute('playsinline')) this.setAttribute('playsinline', '');
      }

      if (touchLike) {
        this._mode = 'touch-controls';
      } else if (wantsControls) {
        this._mode = 'controls';
      } else if (wantsAutoplay) {
        this._mode = 'autoplay';
      } else {
        this._mode = 'hover';
      }

    }

    _autoPlayWanted() {
      // Autoplay is only honored in non-touch, autoplay mode
      return this._mode === 'autoplay';
    }

    _maybeObserve(reset = false) {
      if (this._isEager()) { this._upgrade(); return; }
      if (this._io && !reset) return;
      if (this._io) this._io.disconnect();

      this._io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            this._io.disconnect();
            this._io = null;
            this._upgrade();
            break;
          }
        }
      }, { root: null, rootMargin: this._rootMargin(), threshold: 0.01 });

      this._io.observe(this);
    }

    async _upgrade() {
      if (this._upgraded) return;
      this._upgraded = true;

      const srcHigh = this.getAttribute('src-high');
      if (!srcHigh) { return; }

      try {
        const kind = this._kind();
        if (kind === 'video') {
          await this._prepareVideo(srcHigh);
        } else if (kind === 'gif') {
          await this._prepareGif(srcHigh);
        } else {
          await this._prepareImage(srcHigh);
        }
        this.dispatchEvent(new CustomEvent('pm:loaded-high', { bubbles: true }));
      } catch (err) {
        this.dispatchEvent(new CustomEvent('pm:error', {
          bubbles: true, detail: { phase: 'high', error: String(err?.message || err) }
        }));
      }
    }

    // static image
    async _prepareImage(src) {
      const img = document.createElement('img');
      img.className = 'pm-high';
      img.decoding = 'async';
      img.loading = 'eager';
      const url = await this._fetchAsObjectURL(src);
      img.src = url;
      await img.decode().catch(() => { });
      img.addEventListener('load', () => {
        this._objectURLs.delete(url);
        URL.revokeObjectURL(url);
      }, { once: true });

      this._highEl = img;
      this.appendChild(img);
      requestAnimationFrame(() => {
        img.classList.add('pm-loaded');
        this.classList.add('pm-ready');
      });

      // No controls for static images
      this._ctrl.hidden = true;
    }

    // video (paused visible unless autoplay or hover mode)
    async _prepareVideo(src) {
      const vid = document.createElement('video');
      vid.className = 'pm-high';
      vid.preload = 'auto';

      this._copyBoolAttr(vid, 'muted');
      this._copyBoolAttr(vid, 'loop');
      this._copyBoolAttr(vid, 'playsinline');
      // IMPORTANT: no native controls; overlay only

      const poster = this.getAttribute('poster');
      if (poster) vid.poster = poster;

      const url = await this._fetchAsObjectURL(src);

      vid.addEventListener('loadeddata', () => {
        this._highEl = vid;
        requestAnimationFrame(() => {
          vid.classList.add('pm-loaded');
          this.classList.add('pm-ready');
          if (this._mode !== 'hover') {
            this.classList.add('pm-click');
          }
        });

        // Behavior by mode
        if (this._mode === 'hover') {
          this._setupHoverHandlers();
        } else if (this._autoPlayWanted()) {
          this._ctrl.hidden = false;
          this._playVideo(vid);
        } else {
          // controls / touch-controls
          this._ctrl.hidden = false;
          this._setCtrl('play');
        }

        this._setupPlaybackObserver();
      }, { once: true });

      vid.addEventListener('error', () => {
        this.dispatchEvent(new CustomEvent('pm:error', { bubbles: true, detail: { phase: 'video' } }));
      }, { once: true });

      vid.src = url;
      this.appendChild(vid);
    }

    // gif: paused = still frame; play = animated
    async _prepareGif(src) {
      this._gifAnimatedUrl = await this._fetchAsObjectURL(src);

      const img = document.createElement('img');
      img.className = 'pm-high';
      this._highEl = img;
      this.appendChild(img);

      try {
        this._gifStillDataUrl = await this._gifFirstFrameURL(this._gifAnimatedUrl);
      } catch {
        this._gifStillDataUrl = null;
      }

      // mode-specific initial state
      if (this._mode === 'hover') {
        img.src = this._gifStillDataUrl || this._gifAnimatedUrl;
        this._setupHoverHandlers();
      } else if (this._autoPlayWanted()) {
        this._ctrl.hidden = false;
        img.src = this._gifAnimatedUrl;
        this._setCtrl('pause');
      } else {
        // controls / touch-controls
        this._ctrl.hidden = false;
        if (this._gifStillDataUrl) {
          img.src = this._gifStillDataUrl;
          this._setCtrl('play');
        } else {
          img.src = this._gifAnimatedUrl;
          this._setCtrl('pause');
        }
      }

      requestAnimationFrame(() => {
        img.classList.add('pm-loaded');
        this.classList.add('pm-ready');
        if (this._mode !== 'hover') {
          this.classList.add('pm-click');
        }
      });

      this._setupPlaybackObserver();
    }

    _gifFirstFrameURL(animatedUrl) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth || img.width;
            c.height = img.naturalHeight || img.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(c.toDataURL('image/png'));
          } catch (e) { reject(e); }
        };
        img.onerror = reject;
        img.src = animatedUrl;
      });
    }

    _togglePlay() {
      // In hover mode, playback is hover-driven, not click-driven
      if (this._mode === 'hover') return;

      const kind = this._kind();
      if (kind === 'video' && this._highEl instanceof HTMLVideoElement) {
        if (this._highEl.paused) this._playVideo(this._highEl);
        else this._pauseVideo(this._highEl);
      } else if (kind === 'gif' && this._highEl instanceof HTMLImageElement) {
        if (!this._gifAnimatedUrl) return;
        if (this._highEl.src === this._gifAnimatedUrl) {
          if (this._gifStillDataUrl) {
            this._highEl.src = this._gifStillDataUrl;
            this._setCtrl('play');
          }
        } else {
          this._highEl.src = this._gifAnimatedUrl;
          this._setCtrl('pause');
        }
      }
    }

    _playVideo(vid) {
      if (this.hasAttribute('muted')) vid.muted = true;
      vid.play().catch(() => { });
      this._setCtrl('pause');
    }

    _pauseVideo(vid) {
      vid.pause();
      this._setCtrl('play');
    }

    _setCtrl(state) {
      this._ctrl.dataset.state = state; // play | pause
      this._ctrl.setAttribute('aria-label', state === 'pause' ? 'Pause' : 'Play');
    }

    async _fetchAsObjectURL(src) {
      const signal = (this._externalSignal instanceof AbortSignal)
        ? this._externalSignal
        : this._abort.signal;

      const res = await fetch(src, { signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      this._objectURLs.add(url);
      return url;
    }

    _copyBoolAttr(el, name) { if (this.hasAttribute(name)) el.setAttribute(name, ''); }

    _setupHoverHandlers() {
      if (this._hoverHandlersBound) return;
      this._hoverHandlersBound = true;

      this._onPointerEnter = () => {
        if (this._mode !== 'hover') return;

        // hide the button during hover
        this._ctrl.classList.add('pm-ctrl-hidden');

        const kind = this._kind();
        if (kind === 'video' && this._highEl instanceof HTMLVideoElement) {
          this._playVideo(this._highEl);
        } else if (kind === 'gif' && this._highEl instanceof HTMLImageElement && this._gifAnimatedUrl) {
          this._highEl.src = this._gifAnimatedUrl;
        }
      };

      this._onPointerLeave = () => {
        if (this._mode !== 'hover') return;

        // show the button again when hover ends
        this._ctrl.classList.remove('pm-ctrl-hidden');

        const kind = this._kind();
        if (kind === 'video' && this._highEl instanceof HTMLVideoElement) {
          this._pauseVideo(this._highEl);
        } else if (kind === 'gif' && this._highEl instanceof HTMLImageElement) {
          if (this._gifStillDataUrl) {
            this._highEl.src = this._gifStillDataUrl;
          }
        }
      };

      this.addEventListener('pointerenter', this._onPointerEnter);
      this.addEventListener('pointerleave', this._onPointerLeave);
    }


    _setupPlaybackObserver() {
      if (this._playIO) return;

      this._playIO = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.target !== this) continue;
          const kind = this._kind();
          const isVideo = kind === 'video' && this._highEl instanceof HTMLVideoElement;
          const isGif = kind === 'gif' && this._highEl instanceof HTMLImageElement;

          if (!isVideo && !isGif) return;

          if (!e.isIntersecting) {
            // Leaving viewport: pause if currently playing
            if (isVideo && !this._highEl.paused) {
              this._wasPlayingOnLeave = true;
              this._pauseVideo(this._highEl);
            } else if (isGif && this._highEl.src === this._gifAnimatedUrl) {
              this._wasPlayingOnLeave = true;
              if (this._gifStillDataUrl && this._mode !== 'autoplay') {
                this._highEl.src = this._gifStillDataUrl;
                this._setCtrl('play');
              }
            } else {
              this._wasPlayingOnLeave = false;
            }
          } else {
            // Re-entering viewport: resume only if it *was* playing
            if (!this._wasPlayingOnLeave) return;
            this._wasPlayingOnLeave = false;

            // In hover mode, let hover drive playback
            if (this._mode === 'hover') return;

            if (isVideo) {
              this._playVideo(this._highEl);
            } else if (isGif && this._gifAnimatedUrl) {
              this._highEl.src = this._gifAnimatedUrl;
              this._setCtrl('pause');
            }
          }
        }
      }, { root: null, threshold: 0.01 });

      this._playIO.observe(this);
    }

    _cleanup() {
      this._abort.abort();
      this._abort = new AbortController();

      if (this._io) { this._io.disconnect(); this._io = null; }
      if (this._playIO) { this._playIO.disconnect(); this._playIO = null; }

      if (this._hoverHandlersBound) {
        this.removeEventListener('pointerenter', this._onPointerEnter);
        this.removeEventListener('pointerleave', this._onPointerLeave);
        this._hoverHandlersBound = false;
        this._onPointerEnter = this._onPointerLeave = null;
      }

      this._objectURLs.forEach(URL.revokeObjectURL);
      this._objectURLs.clear();
      this._gifAnimatedUrl = null;
      this._gifStillDataUrl = null;
      this._wasPlayingOnLeave = false;
    }
  }

  customElements.define('progr-media', ProgrMedia);
})();
