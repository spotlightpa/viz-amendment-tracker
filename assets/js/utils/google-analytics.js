import galite from "ga-lite/src/ga-lite.js";
import { each, on, allClosest } from "./dom-utils.js";

// Ensure a Google Analytics window func
if (!window.ga) {
  window.ga = galite;
}

const dnt = !window.location.host.match(/spotlightpa\.org$/);

export function callGA(...args) {
  if (dnt) {
    /* eslint-disable no-console */
    console.group("Google Analytics Debug");
    for (let arg of args) console.log("%o", arg);
    console.groupEnd();
    /* eslint-enable no-console */
    return;
  }
  galite(...args);
}

export function sendGAEvent(ev) {
  callGA("send", "event", ev);
}

export function buildEvent(el) {
  let eventCategory = allClosest(el, "[data-ga-category]")
    .map((el) => el.dataset.gaCategory)
    .join(":");
  let eventAction = allClosest(el, "[data-ga-action]")
    .map((el) => el.dataset.gaAction)
    .join(":");
  let eventLabel = allClosest(el, "[data-ga-label]")
    .map((el) => el.dataset.gaLabel)
    .join(":");

  return {
    eventCategory,
    eventAction,
    eventLabel,
  };
}

export function buildAndSend(el, overrides) {
  let event = buildEvent(el);
  sendGAEvent({ ...event, ...overrides });
}

export function buildClick(ev) {
  let gaEvent = buildEvent(ev.target);
  if (!gaEvent.eventAction) {
    gaEvent.eventAction = ev.target.href;
  }

  if (!gaEvent.eventAction) {
    gaEvent.eventAction = ev.currentTarget.href;
  }
  gaEvent.transport = "beacon";
  return normalizeEvent(gaEvent);
}

function normalizeEvent(gaEvent) {
  let { eventAction: action } = gaEvent;
  if (action) {
    action = action.replace(
      /^(https?:\/\/(www\.)?spotlightpa\.org)/,
      "https://www.spotlightpa.org"
    );
    if (action.match(/checkout\.fundjournalism\.org\/memberform/)) {
      action = "https://www.spotlightpa.org/donate/";
    }
    if (action.match(/^https:\/\/www\.spotlightpa\.org.*[^/]$/)) {
      action = action + "/";
    }
    gaEvent.eventAction = action;
  }
  return gaEvent;
}

export function reportClick(ev) {
  let gaEvent = buildClick(ev);

  sendGAEvent(gaEvent);
}

export function addGAListeners() {
  let el = document.querySelector("[data-ga-settings]");
  if (!el) {
    // eslint-disable-next-line no-console
    console.warn("could not load GA!");
    return;
  }
  let { gaId, gaPageTitle, gaPagePath, gaPageUrl } = el.dataset;

  callGA("create", gaId, "auto");
  callGA("send", "pageview", gaPagePath, {
    title: gaPageTitle,
    location: gaPageUrl,
  });

  window.addEventListener("pagehide", () => {
    sendGAEvent({
      transport: "beacon",
      nonInteraction: true,
    });
  });

  window.addEventListener("error", (ev) => {
    callGA("send", "exception", {
      exDescription: ev.message,
      exFatal: true,
    });
  });

  each("a", (el) => {
    on("click", el, (ev) => {
      let gaEvent = buildClick(ev);
      sendGAEvent(gaEvent);
    });
  });

  on("click", "[data-ga-button]", (ev) => {
    reportClick(ev);
  });
}
