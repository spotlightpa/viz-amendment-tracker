import { Framer } from "js/framer/index.mjs";

import { each, onLoad } from "./utils/dom-utils.js";

onLoad(() => {
  each("[data-spl-interactive=viz-redistricting-2020]", (el) => {
    // Bail if we were already attached or old JS
    if (el.shadowRoot || !("attachShadow" in el)) {
      return;
    }
    let [, src] = /(.*)embed\.js$/.exec(document.currentScript.src);
    if (!src || !/^(\/|http)/.test(src)) {
      // eslint-disable-next-line no-console
      console.warn("bad embed URL", src);
      return;
    }
    src += "#host_page=" + encodeURIComponent(window.location.href);
    // Use shadowDOM to override CSS for iframes
    let container = el.attachShadow({ mode: "open" });
    let sandbox =
      "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation";
    let allow = "geolocation";
    new Framer({ container, src, sandbox, allow });
  });
});
