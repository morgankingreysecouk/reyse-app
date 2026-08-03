/*
 * Reyse Live Chat -- embed loader.
 *
 * Paste this on any page:
 *   <script src="https://app.reyse.co.uk/widget.js" data-reyse-key="CLIENT_WIDGET_KEY" async></script>
 *
 * This script itself is genuinely static and client-agnostic (the same file
 * serves every client), which is why it lives in Next's public/ folder for
 * free CDN-friendly caching rather than being server-rendered. All the
 * per-client work -- branding, property knowledge, the AI itself -- lives
 * behind the sandboxed iframe this injects, keyed by the public widgetKey
 * read from the script tag.
 */
(function () {
  if (window.__reyseWidgetLoaded) return;
  window.__reyseWidgetLoaded = true;

  var scriptEl = document.currentScript;
  if (!scriptEl) return;

  var widgetKey = scriptEl.getAttribute("data-reyse-key");
  if (!widgetKey) {
    console.error("Reyse widget: missing data-reyse-key attribute on the script tag.");
    return;
  }

  // Derived from the script's own src, not hardcoded -- this is what lets
  // the same script work whether reyse-app is reached via its Railway URL
  // or app.reyse.co.uk, with nothing to misconfigure per environment (same
  // reasoning already applied to the Mail Assistant's OAuth redirect URI).
  var origin;
  try {
    origin = new URL(scriptEl.src).origin;
  } catch {
    console.error("Reyse widget: couldn't determine the widget's own origin.");
    return;
  }

  var LAUNCHER_SIZE = 64;
  var MARGIN = 20;
  var PANEL_WIDTH = 384;
  var PANEL_HEIGHT = 512;

  // Extra bottom offset a host page can request at runtime -- e.g. to sit
  // above its own cookie banner or sticky CTA bar, both of which can appear
  // and disappear or change height after this script has already mounted
  // the iframe. Set via window.ReyseWidget.setBottomOffset(px) below.
  var extraBottomOffset = 0;
  var isOpen = false;

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/widget/" + encodeURIComponent(widgetKey);
  iframe.title = "Chat";
  iframe.style.position = "fixed";
  iframe.style.right = MARGIN + "px";
  iframe.style.width = LAUNCHER_SIZE + "px";
  iframe.style.height = LAUNCHER_SIZE + "px";
  iframe.style.border = "none";
  iframe.style.background = "transparent";
  iframe.style.zIndex = "2147483647";
  iframe.style.borderRadius = "9999px";
  iframe.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
  iframe.style.transition = "width 0.2s ease,height 0.2s ease,border-radius 0.2s ease,bottom 0.2s ease";

  function applyPosition() {
    var bottom = MARGIN + extraBottomOffset;
    iframe.style.bottom = bottom + "px";
    iframe.style.maxWidth = "calc(100vw - " + MARGIN * 2 + "px)";
    iframe.style.maxHeight = "calc(100vh - " + bottom + "px - " + MARGIN + "px)";
  }
  applyPosition();

  function mount() {
    document.body.appendChild(iframe);
  }
  if (document.body) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || event.source !== iframe.contentWindow) return;
    var data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "reyse:open") {
      isOpen = true;
      var width = Math.min(PANEL_WIDTH, window.innerWidth - MARGIN * 2);
      var height = Math.min(PANEL_HEIGHT, window.innerHeight - MARGIN * 2 - extraBottomOffset);
      iframe.style.width = width + "px";
      iframe.style.height = height + "px";
      iframe.style.borderRadius = "16px";
    } else if (data.type === "reyse:close") {
      isOpen = false;
      iframe.style.width = LAUNCHER_SIZE + "px";
      iframe.style.height = LAUNCHER_SIZE + "px";
      iframe.style.borderRadius = "9999px";
    }
  });

  // Public API for the host page itself (not the iframe) to nudge the
  // widget's position -- same-page JS, not postMessage, since this is a
  // same-origin call from code the host page owns (e.g. a cookie-banner
  // component reporting its own height).
  window.ReyseWidget = {
    setBottomOffset: function (px) {
      extraBottomOffset = typeof px === "number" && px > 0 ? px : 0;
      applyPosition();
      if (isOpen) {
        iframe.style.height = Math.min(PANEL_HEIGHT, window.innerHeight - MARGIN * 2 - extraBottomOffset) + "px";
      }
    },
  };

  // Proactive engagement signals -- time-on-page and exit-intent both have
  // to be observed from the host page's own document; a cross-origin
  // iframe cannot see either. This script only forwards the raw signal --
  // the iframe already has its own config (fetched same-origin on load)
  // and decides whether/how to react.
  var startedAt = Date.now();
  var tickInterval = setInterval(function () {
    if (!iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "reyse:tick", elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) },
      origin,
    );
  }, 5000);

  var exitIntentFired = false;
  document.addEventListener("mouseleave", function (event) {
    if (exitIntentFired || event.clientY > 0 || !iframe.contentWindow) return;
    exitIntentFired = true;
    clearInterval(tickInterval);
    iframe.contentWindow.postMessage({ type: "reyse:exit-intent" }, origin);
  });
})();
