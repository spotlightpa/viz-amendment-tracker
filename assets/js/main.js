import Alpine from "alpinejs/src/index.js";
import { initFrameAndPoll } from "@newswire/frames";
import { addGAListeners, reportClick } from "./utils/google-analytics.js";

import { data as rows } from "json/amtrack.json";

console.log(rows);

Alpine.magic("report", () => (ev) => reportClick(ev));
Alpine.data("app", () => {
  return {
    rows,
  };
});

Alpine.start();
addGAListeners();
initFrameAndPoll();
