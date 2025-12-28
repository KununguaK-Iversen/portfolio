import { getModalRouteFromPath } from "./routes.js";

export function initRouter(Alpine) {
  const modal = Alpine.store("modal");

  function handlePath(pathname) {
    const modalRoute = getModalRouteFromPath(pathname);

    if (modalRoute) {
      modal.openFromRoute(modalRoute);
    } else {
      modal.closeFromRoute();
    }
  }

  const initialPath = window.location.pathname;
  const isInitialModal = !!getModalRouteFromPath(initialPath);
  const state = history.state;

  // First time our SPA runs in this tab?
  const isFirstAppRun = !state || state.__app !== "portfolio-router";

  if (isFirstAppRun) {
    if (isInitialModal) {
      // We *landed* on /pages/:slug in this tab.
      // Step 1: turn the current entry into "/" (no network navigation)
      history.replaceState(
        { __app: "portfolio-router", kind: "base" },
        "",
        "/"
      );

      // Step 2: push the modal route on top
      history.pushState(
        { __app: "portfolio-router", kind: "modal" },
        "",
        initialPath
      );
    } else {
      // Normal entry ("/", "/work", etc.)
      history.replaceState(
        { __app: "portfolio-router", kind: "base" },
        "",
        initialPath
      );
    }
  }

  // React to whatever the *current* URL is now
  handlePath(window.location.pathname);

  // Back/forward
  window.addEventListener("popstate", () => {
    handlePath(window.location.pathname);
  });

  // Click hijacking for same-origin links to /pages/:slug
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const anchor = event.target.closest("a[href]");
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin) return;

    const modalRoute = getModalRouteFromPath(url.pathname);
    if (!modalRoute) {
      // non-modal link; let browser handle normally
      return;
    }

    event.preventDefault();

    if (url.pathname !== window.location.pathname) {
      history.pushState(
        { __app: "portfolio-router", kind: "modal" },
        "",
        url.pathname
      );
    }

    handlePath(url.pathname);
  });
}
