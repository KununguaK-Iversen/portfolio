(function registerOnce() {
    if (customElements.get('progr-media')) return;

    // Injects minimal styles once (overridable by global SCSS)
    const STYLE_MARK = 'data-progr-media-style';
    if (!document.head.querySelector(`style[${STYLE_MARK}]`)) {
        const style = document.createElement('style');
        style.setAttribute(STYLE_MARK, '');
        style.textContent = `
      progr-media{display:block;position:relative;contain:layout}
      progr-media .pm-low, progr-media .pm-high{
        position:absolute; inset:0; display:block;width:100%;height:auto;border-radius:inherit;
        transition:opacity .4s ease;
      }
      progr-media .pm-low{opacity:1}
      progr-media .pm-high{opacity:0}
      progr-media .pm-high.pm-loaded{opacity:1}
      progr-media video.pm-high, progr-media img.pm-high{width:100%;height:auto;object-fit:cover;display:block}
    `;
        document.head.appendChild(style);
    }

    const VIDEO_EXT = /\.(mp4|webm|ogg|m4v|mov)(\?|#|$)/i;

    class ProgrMedia extends HTMLElement {

        /**
        * Tell the Custom Elements runtime which attributes to watch.
        * When any of these change, `attributeChangedCallback()` will run.
        *
        * - src-high   : URL of the high-res media to progressively load (img/video).
        * - kind       : Explicit media type override: "img" | "image" | "video".
        *                If omitted, type is inferred from `src-high` extension.
        * - eager      : If present, skip IntersectionObserver and upgrade immediately.
        * - rootmargin : IntersectionObserver rootMargin (e.g., "400px 0px") to prefetch earlier.
        * - object-fit : Controls how the high layer fills the box (cover|contain|fill…).
        * - poster     : Optional poster image for video before frames are available.
        */
        static get observedAttributes() {
            return ['src-high', 'kind', 'eager', 'rootmargin', 'object-fit', 'poster'];
        }

        constructor() {
            super();
            this._io = null;
            this._abort = new AbortController();
            this._objectURLs = new Set();
            this._upgraded = false;
        }

        connectedCallback() {
            const low = this._findLowImg();
            if (!low) {
                console.warn('<progr-media> expects a child <img> as the low-res preview.');
                return;
            }

            low.classList.add('pm-low'); // low-res preview is marked as 'low'
            this.appendChild(low); // Attach directly to progr-media

            // Allow object-fit override via attribute or CSS var
            if (this.hasAttribute('object-fit')) {
                this.style.setProperty('--pm-object-fit', this.getAttribute('object-fit'));
            }

            this._maybeObserve();
        }

        disconnectedCallback() { this._cleanup(); }
        attributeChangedCallback() {
            if (this.isConnected && !this._upgraded) this._maybeObserve(true);
        }

        // Optional: you can set an external AbortSignal (e.g., Alpine store) via property:
        //   document.querySelector('progr-media').signal = Alpine.store('modal').signal
        set signal(sig) { this._externalSignal = sig; }

        // ---- internals
        _findLowImg() {
            const el = this.firstElementChild;
            if (!el) return null;
            return el.tagName === 'IMG' ? el : el.querySelector?.('img') || null;
        }

        _kind() {
            const explicit = (this.getAttribute('kind') || '').toLowerCase();
            if (explicit === 'img' || explicit === 'image') return 'img';
            if (explicit === 'video') return 'video';
            const src = this.getAttribute('src-high') || '';
            return VIDEO_EXT.test(src) ? 'video' : 'img';
        }

        _rootMargin() { return this.getAttribute('rootmargin') || '200px 0px'; }
        _isEager() { return this.hasAttribute('eager'); }

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
            if (!srcHigh) return;

            try {
                const kind = this._kind();
                if (kind === 'img') {
                    await this._upgradeImage(srcHigh);
                } else {
                    await this._upgradeVideo(srcHigh);
                }

                // Fade-in the high-res image
                requestAnimationFrame(() => this._highEl.classList.add('pm-loaded'));
                this.dispatchEvent(new CustomEvent('pm:loaded-high', { bubbles: true }));
            } catch (err) {
                this.dispatchEvent(new CustomEvent('pm:error', {
                    bubbles: true, detail: { phase: 'high', error: String(err?.message || err) }
                }));
            }
        }

        async _upgradeImage(src) {
            const img = document.createElement('img');
            img.className = 'pm-high';
            img.decoding = 'async';
            img.loading = 'eager';
            img.src = await this._fetchAsObjectURL(src);
            await img.decode().catch(() => { });
            img.addEventListener('load', () => {
                this._objectURLs.delete(img.src);
            }, { once: true });

            this._highEl = img;
            this.appendChild(img); // overlay on top of low-res image
        }

        async _upgradeVideo(src) {
            const vid = document.createElement('video');
            vid.className = 'pm-high';
            vid.preload = 'auto';
            this._copyBoolAttr(vid, 'autoplay');
            this._copyBoolAttr(vid, 'muted');
            this._copyBoolAttr(vid, 'loop');
            this._copyBoolAttr(vid, 'playsinline');
            this._copyBoolAttr(vid, 'controls');

            const url = await this._fetchAsObjectURL(src);
            const wasPaused = true; // assuming we start paused from poster/preview
            const onLoaded = async () => {
                if (!wasPaused && vid.autoplay) {
                    try { await vid.play(); } catch { }
                }
                URL.revokeObjectURL(url);
                this._objectURLs.delete(url);
            };

            vid.addEventListener('loadeddata', onLoaded, { once: true });
            vid.addEventListener('error', () => {
                this.dispatchEvent(new CustomEvent('pm:error', { bubbles: true, detail: { phase: 'video' } }));
            }, { once: true });

            vid.src = url;
            this._highEl = vid;
            this.appendChild(vid);
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

        _cleanup() {
            this._abort.abort();
            this._abort = new AbortController();
            if (this._io) { this._io.disconnect(); this._io = null; }
            this._objectURLs.forEach(URL.revokeObjectURL);
            this._objectURLs.clear();
        }
    }

    customElements.define('progr-media', ProgrMedia);
})();