import Alpine from "alpinejs/src/index.js";
import * as L from "leaflet";
import { initFrameAndPoll } from "js/framer/index.mjs";

import { addGAListeners, reportClick } from "./utils/google-analytics.js";

import * as oldHouse from "data/house-2012.json";
import * as newHouse from "data/house-2022.json";
import * as oldSenate from "data/senate-2012.json";
import * as newSenate from "data/senate-2022.json";
import * as params from "@params";

L.Marker.prototype.options.icon = L.icon({
  iconUrl: "/images/marker-icon.png",
  iconRetinaUrl: "/images/marker-icon-2x.png",
  shadowUrl: "/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

const locate = () =>
  new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject)
  );

const toFloat = (s) => {
  s = s.replace("%", "");
  if (isNaN(s)) {
    return 0;
  }
  return parseFloat(s);
};

Alpine.directive(
  "template",
  (el, { expression }, { effect, evaluateLater }) => {
    let evalStr = expression
      ? "`" + expression + "`"
      : "`" + el.innerHTML.trim() + "`";
    let evaluate = evaluateLater(evalStr);

    effect(() => {
      evaluate((value) => {
        el.innerHTML = value;
      });
    });
  }
);

let commaFormatter = new Intl.NumberFormat("en-US");
Alpine.magic("comma", () => (n) => commaFormatter.format(n));

Alpine.magic("report", () => (ev) => reportClick(ev));

Alpine.store("state", {
  oldHouse: "103",
  newHouse: "103",
  oldSenate: "15",
  newSenate: "15",

  lat: 40.26444,
  long: -76.88375,

  get latLong() {
    return [this.lat, this.long];
  },

  async updateAddress() {
    if (!this.address) {
      return;
    }
    return this.callAPI(
      "/api/by-address?address=" + encodeURIComponent(this.address)
    );
  },

  async updateLocation([lat, long]) {
    this.lat = lat;
    this.long = long;

    return this.callAPI(
      "/api/by-location?lat=" +
        encodeURIComponent(this.lat) +
        "&long=" +
        encodeURIComponent(this.long)
    );
  },

  async callAPI(path) {
    return fetch(params.apiBaseURL + path)
      .then((rsp) => rsp.json())
      .then((json) => {
        if (json.error_message) {
          throw Error(json.error_message);
        }
        this.update(json);
      });
  },

  update(json) {
    let { address, lat, long, old_house, new_house, old_senate, new_senate } =
      json;

    this.address = address || this.address;
    this.lat = lat || this.lat;
    this.long = long || this.long;
    this.oldHouse = old_house || this.oldHouse;
    this.newHouse = new_house || this.newHouse;
    this.oldSenate = old_senate || this.oldSenate;
    this.newSenate = new_senate || this.newSenate;
    if (
      ![old_house, new_house, old_senate, new_senate].every((item) => !!item)
    ) {
      throw new Error("District could not be found.");
    }
  },
});

Alpine.data("app", () => {
  return {
    error: null,

    isLoading: false,
    recentlyChanged: false,

    init() {
      let timeoutID = null;
      this.$watch("isLoading", (val) => {
        if (val) {
          this.recentlyChanged = true;
          window.clearTimeout(timeoutID);
          timeoutID = window.setTimeout(() => {
            this.recentlyChanged = false;
          }, 1000);
        }
      });
    },

    get isLoadingThrottled() {
      return this.isLoading || this.recentlyChanged;
    },

    async byAddress() {
      if (this.isLoading) {
        return;
      }
      this.isLoading = true;
      return this.$store.state
        .updateAddress()
        .then(() => {
          this.error = null;
        })
        .catch((e) => {
          this.error = e;
        })
        .finally(() => {
          this.isLoading = false;
          this.$report({ target: this.$el });
        });
    },

    async byLocation() {
      if (this.isLoading) {
        return;
      }
      try {
        let { coords } = await locate();
        this.isLoading = true;
        await this.$store.state.updateLocation([
          coords.latitude,
          coords.longitude,
        ]);
        this.error = null;
      } catch (e) {
        this.error = e;
      } finally {
        this.isLoading = false;
        this.$report({ target: this.$el });
      }
    },
  };
});

Alpine.data("map", (propName) => {
  let propSrc = {
    oldHouse,
    newHouse,
    oldSenate,
    newSenate,
  }[propName];

  return {
    map: null,
    latLong: null,
    marker: null,
    layer: null,
    propType: null,
    district: "",
    urlPattern: "",

    get props() {
      return !this.district ? {} : propSrc[this.district];
    },

    partyClass(name) {
      return name.startsWith("R")
        ? "chart-red"
        : name.startsWith("D")
        ? "chart-blue"
        : "chart-purple";
    },
    propNames: {
      per_asian: "an Asian",
      per_black: "a Black",
      per_hispanic: "a Hispanic",
      per_white: "a white",
      per_mixed: "a mixed-race",
      per_misc: "an other race",

      per_dem: "Democrats",
      per_rep: "Republicans",
      per_other: "third party or unaffiliated",
    },
    plurality(names) {
      if (!this.props) {
        return "";
      }

      let max = 0;
      let maxName = "";
      for (let name of names) {
        let val = toFloat(this.props[name]);
        if (val > max) {
          max = val;
          maxName = name;
        }
      }
      return maxName;
    },

    isMajority(name) {
      return toFloat(this.props[name]) > 50;
    },

    isSuperMajority(name) {
      return toFloat(this.props[name]) > 60;
    },

    get pluralityRace() {
      return this.plurality([
        "per_asian",
        "per_black",
        "per_hispanic",
        "per_white",
        "per_mixed",
        "per_misc",
      ]);
    },

    get majorityRace() {
      let prop = this.pluralityRace;
      return this.isMajority(prop) ? prop : "";
    },

    get superMajorityRace() {
      let prop = this.pluralityRace;
      return this.isSuperMajority(prop) ? prop : "";
    },

    get pluralityParty() {
      return this.plurality(["per_dem", "per_rep", "per_other"]);
    },

    get majorityParty() {
      let prop = this.pluralityParty;
      return this.isMajority(prop) ? prop : "";
    },

    get superMajorityParty() {
      let prop = this.pluralityParty;
      return this.isSuperMajority(prop) ? prop : "";
    },

    init() {
      this.map = L.map(this.$refs.leaflet, {
        center: [this.$store.state.lat, this.$store.state.long],
        scrollWheelZoom: false,
        zoom: 12,
        zoomSnap: 1,
      });
      this.map.createPane("labels");
      this.map.getPane("labels").style.zIndex = 400;
      this.map.getPane("labels").style.pointerEvents = "none";
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
        }
      ).addTo(this.map);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          pane: "labels",
        }
      ).addTo(this.map);

      this.marker = L.marker(this.$store.state.latLong, {
        draggable: true,
        zIndexOffset: 651,
      });
      this.marker.on("moveend", () => {
        let { lat, lng } = this.marker.getLatLng();
        if (!lat || !lng) return;

        this.$store.state.updateLocation([lat, lng]);
        this.$report({ target: this.$refs.leaflet });
      });
      this.marker.addTo(this.map);

      this.$watch("latLong", ([newLat, newLong]) => {
        let { lat: oldLat, lng: oldLong } = this.marker.getLatLng();
        if (oldLat !== newLat || oldLong != newLong) {
          this.marker.setLatLng(this.latLong);
          this.map.panTo(this.latLong);
          this.$nextTick(() => this.map.invalidateSize(true));
        }
      });

      this.$watch("district", async (district) => {
        let url = this.urlPattern.replace("%%", district);

        if (this.layer) this.layer.remove();
        let geojsonFeature;
        try {
          geojsonFeature = await fetch(url).then((rsp) => rsp.json());
        } catch (e) {
          this.error = e;
          return;
        }
        let layer = L.geoJSON(geojsonFeature);
        layer.setStyle({
          weight: 1,
          color: "#cda52d",
          fillColor: "#ffcb05",
          fillOpacity: 0.5,
        });
        this.layer = layer;
        let props = geojsonFeature.features[0].properties;
        layer.bindPopup(() => `District ${props.district}`);
        layer.addTo(this.map);
        this.map.flyToBounds(layer.getBounds());
        this.$nextTick(() => this.map.invalidateSize(true));
      });
    },
  };
});

Alpine.start();
addGAListeners();
initFrameAndPoll();
