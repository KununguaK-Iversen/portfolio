import "./build_assets/styles.scss"; // Styling
import './components/progr-media/progr-media.js'; // registers <progr-media> web-component
import sal from "sal.js"; // Animation https://github.com/mciastek/sal
import Alpine from "alpinejs"; // Framework https://alpinejs.dev/
import { X, FileText, Mail, SquareArrowOutUpRight, FileUser, ScrollText } from "lucide-static"; // Generic icons https://lucide.dev/
import { siGithub, siWhatsapp } from "simple-icons"; // Brand icons https://simpleicons.org/

document.documentElement.classList.remove("loading");
document.documentElement.classList.add("ready");

Alpine.store("icons", {
  X,
  FileText,
  Mail,
  SquareArrowOutUpRight,
  FileUser,
  ScrollText,
  github: simpleIconsToSvg(siGithub),
  whatsapp: simpleIconsToSvg(siWhatsapp),
  linkedin: `<svg style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;" version="1.1" viewBox="0 0 512 512" width="24" height="24" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:serif="http://www.serif.com/" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M449.446,0c34.525,0 62.554,28.03 62.554,62.554l0,386.892c0,34.524 -28.03,62.554 -62.554,62.554l-386.892,0c-34.524,0 -62.554,-28.03 -62.554,-62.554l0,-386.892c0,-34.524 28.029,-62.554 62.554,-62.554l386.892,0Zm-288.985,423.278l0,-225.717l-75.04,0l0,225.717l75.04,0Zm270.539,0l0,-129.439c0,-69.333 -37.018,-101.586 -86.381,-101.586c-39.804,0 -57.634,21.891 -67.617,37.266l0,-31.958l-75.021,0c0.995,21.181 0,225.717 0,225.717l75.02,0l0,-126.056c0,-6.748 0.486,-13.492 2.474,-18.315c5.414,-13.475 17.767,-27.434 38.494,-27.434c27.135,0 38.007,20.707 38.007,51.037l0,120.768l75.024,0Zm-307.552,-334.556c-25.674,0 -42.448,16.879 -42.448,39.002c0,21.658 16.264,39.002 41.455,39.002l0.484,0c26.165,0 42.452,-17.344 42.452,-39.002c-0.485,-22.092 -16.241,-38.954 -41.943,-39.002Z"/></svg>`,
});

Alpine.store("modal", {
  isOpenClass: "modal-is-open",
  openingClass: "modal-is-opening",
  closingClass: "modal-is-closing",
  scrollbarWidthCssVar: "--pico-scrollbar-width",
  animationDuration: 400,
  loading: false,
  title: "",
  html: "",

  getScrollbarWidth() {
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    return scrollbarWidth;
  },

  async openModal(p) {
    const slug = p.slug;
    const modal = document.getElementById("modal-dialog");
    const { documentElement: html } = document;
    const scrollbarWidth = this.getScrollbarWidth();
    if (scrollbarWidth) {
      html.style.setProperty(this.scrollbarWidthCssVar, `${scrollbarWidth}px`);
    }
    html.classList.add(this.isOpenClass, this.openingClass);
    this.loading = true;
    this.title = p.title;
    history.pushState({ slug }, "", `#${slug}`);

    modal.showModal();
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}pages/${slug}/${slug}.html`,
        {
          cache: "no-cache"
        }
      );
      const markup = await res.text();
      if (!res.ok) {
        throw new Error(res.status);
      }
      // Load that page’s module
      const mod = await import(`./pages/${slug}/${slug}.js`);
      mod.init?.();
      this.html = markup;
    } catch (err) {
      this.html = `<article><h3>Page request failed, ${err}</h3><p style="color: var(--pico-muted-color)">/pages/${slug}.html</p></article>`;
    } finally {
      this.loading = false;
    }

    setTimeout(() => {
      html.classList.remove(this.openingClass);
    }, this.animationDuration);

    // Pico auto-focuses close-button :-(
    document.activeElement?.blur();
  },

  closeModal() {
    const modal = document.getElementById("modal-dialog");
    const { documentElement: html } = document;
    html.classList.add(this.closingClass);
    setTimeout(() => {
      html.classList.remove(this.closingClass, this.isOpenClass);
      html.style.removeProperty(this.scrollbarWidthCssVar);
      modal.close();
      this.html = "";
      this.title = "";
    }, this.animationDuration);

    if (location.hash)
      history.replaceState({}, "", location.pathname + location.search);
  },
});

/*
 * Convert icons from simple-icons lib to SVG string.
 * Globally available
 */
function simpleIconsToSvg(icon, size = 24) {
  return `
    <svg role="img" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="${icon.path}" />
    </svg>
  `;
}
window.simpleIconsToSvg = simpleIconsToSvg;

const animlib = sal({ threshold: 0.2 }); // fire up Sal animation lib
window.Alpine = Alpine;
Alpine.start();
