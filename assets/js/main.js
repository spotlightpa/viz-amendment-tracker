import Alpine from "alpinejs/src/index.js";
import { initFrameAndPoll } from "@newswire/frames";
import { addGAListeners, reportClick } from "./utils/google-analytics.js";

import { data as rawRows } from "json/amtrack.json";

import { apdate } from "journalize";

const toWeekday = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

export function formatDate(d) {
  if (!d) {
    return "";
  }
  if (typeof d === "string") {
    d = new Date(d);
  }
  return toWeekday.format(d) + ", " + apdate(d);
}

function maybeDate(s) {
  if (!s) {
    return null;
  }
  return new Date(s);
}

function cmp(a, b) {
  return a === b ? 0 : a < b ? -1 : 1;
}

function fuzzyMatch(str, substr) {
  return str.indexOf(substr.toLowerCase()) >= 0;
}

class Amendment {
  constructor(row) {
    this.name = row["BillNumber"];
    this.notes = row["Notes"];
    this.party = row["Party"];
    this.passed = row["PassedLastSession"]?.toLowerCase() === "yes";
    this.id = row["RowID"];
    this.sponsor = row["Sponsor"];
    this.status = row["Status"];
    this.topics = row["Topics"];
    this.legisURL = row["Url"];
    this.openStatesURL = row["OpenStatesUrl"];
    this.formerSessionURL = row["FormerSessionUrl"];
    this.description = row["WhatWouldItDo"];
    this.searchFields =
      `${this.name} ${this.sponsor} ${this.party} ${this.topics} ${this.notes} ${this.description}`.toLowerCase();
    this.houseCommittee = "none";
    this.houseVote = "none";
    this.senateCommittee = "none";
    this.senateVote = "none";
    this.progress = 0;

    if (!row.OpenStatesInfo) {
      this.actions = [];
      return;
    }
    this.session = row.OpenStatesInfo.session;
    this.from = row.OpenStatesInfo.from_organization.name;
    this.shortName = row.OpenStatesInfo.identifier;
    this.title = row.OpenStatesInfo.title;
    this.firstActionDate = maybeDate(row.OpenStatesInfo.first_action_date);
    this.latestActionDate = maybeDate(row.OpenStatesInfo.latest_action_date);
    this.latestAction = row.OpenStatesInfo.latest_action_description;
    this.latestPassageDate = maybeDate(row.OpenStatesInfo.latest_passage_date);
    this.actions = row.OpenStatesInfo.actions.map((action) => ({
      where: action.organization.name,
      description: action.description,
      date: maybeDate(action.date),
      kind: action.classification,
    }));

    let actionClassifications = [...row.OpenStatesInfo.actions]
      .sort((a, b) => cmp(a.date, b.date))
      .flatMap((a) => a.classification.map((c) => [c, a.organization.name]));
    for (let [act, where] of actionClassifications) {
      if (act === "failure") {
        if (where === "House") {
          this.houseVote = "fail";
        } else {
          this.senateVote = "fail";
        }
      } else if (act === "committee-failure") {
        if (where === "House") {
          this.houseCommittee = "fail";
        } else {
          this.senateCommittee = "fail";
        }
      } else if (act === "passage") {
        if (where === "House") {
          this.houseCommittee = "pass";
          this.houseVote = "pass";
        } else {
          this.senateCommittee = "pass";
          this.senateVote = "pass";
        }
      } else if (act === "committee-passage") {
        if (where === "House") {
          this.houseCommittee = "pass";
        } else {
          this.senateCommittee = "pass";
        }
      }
    }

    this.progress += this.houseVote === "pass" ? 3 : 0;
    this.progress += this.senateVote === "pass" ? 3 : 0;
    this.progress += this.houseCommittee === "pass" ? 1 : 0;
    this.progress += this.senateCommittee === "pass" ? 1 : 0;

    this.searchFields +=
      `${this.title} ${this.shortName} ${this.session}`.toLowerCase();
  }

  get isRep() {
    return this.party === "R";
  }
}

let rows = rawRows.map((row) => new Amendment(row));

Alpine.magic("date", () => (s) => formatDate(s));
Alpine.magic("report", () => (ev) => reportClick(ev));

Alpine.data("app", () => {
  const now = new Date();
  const sortByActivity = (a, b) =>
    cmp(b.latestActionDate ?? now, a.latestActionDate ?? now);
  const sortByName = (a, b) => cmp(a.name, b.name);
  const sortByProposedNew = (a, b) =>
    cmp(b.firstActionDate ?? now, a.firstActionDate ?? now);
  const sortByProposedOld = (a, b) =>
    cmp(a.firstActionDate ?? now, b.firstActionDate ?? now);
  const sortByProgress = (a, b) => cmp(b.progress, a.progress);

  return {
    showAll: true,
    sortBy: "progress",
    filterText: "",

    get rows() {
      let retRows = rows;
      let sortFunc =
        this.sortBy === "activity"
          ? sortByActivity
          : this.sortBy === "name"
          ? sortByName
          : this.sortBy === "progress"
          ? sortByProgress
          : this.sortBy === "proposed-new"
          ? sortByProposedNew
          : sortByProposedOld;
      retRows.sort(sortFunc);
      if (this.filterText) {
        retRows = retRows.filter((row) =>
          fuzzyMatch(row.searchFields, this.filterText)
        );
      }
      return retRows;
    },
  };
});

Alpine.start();
addGAListeners();
initFrameAndPoll();
