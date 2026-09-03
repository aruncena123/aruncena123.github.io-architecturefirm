"use strict";
/* =========================================================
   PUBLIC SPACE RESEARCH LABORATORY
   Vanilla JS research instrument. No frameworks, no build step.
   Architecture: Utils / Store / SpaceModel / Metrics / CalcEngine /
   StatsEngine / ExperimentEngine / DatasetManager / ObservationManager /
   ParticipantManager / SnapshotManager / LogManager / Viz / Charts /
   ReportGenerator / UI
   ========================================================= */

/* ===================== UTILS ===================== */
const Utils = (() => {
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function uid(prefix) { return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
  function nowISO() { return new Date().toISOString(); }
  function fmtTime(iso) { try { return new Date(iso).toLocaleString(); } catch (e) { return iso; } }
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function csvEscape(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function debounce(fn, ms) {
    let t = null;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }
  function toast(message, type) {
    const c = document.getElementById("toastContainer");
    if (!c) return;
    const el = document.createElement("div");
    el.className = "toast" + (type ? " toast-" + type : "");
    el.textContent = message;
    c.appendChild(el);
    setTimeout(() => { el.remove(); }, 3800);
  }
  function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
  function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  function sd(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1);
    return Math.sqrt(v);
  }
  function quartiles(arr) {
    if (!arr.length) return { q1: 0, q2: 0, q3: 0, min: 0, max: 0 };
    const s = [...arr].sort((a, b) => a - b);
    const q2 = median(s);
    const lower = s.slice(0, Math.floor(s.length / 2));
    const upper = s.slice(Math.ceil(s.length / 2));
    return { q1: median(lower), q2, q3: median(upper), min: s[0], max: s[s.length - 1] };
  }
  function pearson(xs, ys) {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return null;
    const mx = mean(xs.slice(0, n)), my = mean(ys.slice(0, n));
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    if (dx2 === 0 || dy2 === 0) return null;
    return num / Math.sqrt(dx2 * dy2);
  }
  return {
    clamp, round1, uid, nowISO, fmtTime, deepClone, mulberry32, hashString,
    csvEscape, download, svgEl, debounce, toast, mean, median, sd, quartiles, pearson
  };
})();

/* ===================== SPACE MODEL ===================== */
const SpaceModel = (() => {
  const OBJ_CATS = ["entrances", "pathways", "seats", "trees", "shades", "lights", "water", "edges", "nodes", "obstacles"];
  const SEAT_TYPES = ["bench", "individual", "clustered", "linear", "circular", "movable"];
  const NODE_TYPES = ["playground", "food", "performance", "exercise", "gathering", "quiet"];
  const EDGE_TYPES = ["shop", "cafe", "transparent", "blank"];
  const SHADE_TYPES = ["pergola", "canopy", "built"];

  function emptyObjects() {
    const o = {};
    OBJ_CATS.forEach(c => o[c] = []);
    return o;
  }

  function defaultGeometry() { return { width: 40, length: 60, openness: 60, enclosure: 40 }; }
  function defaultParams() {
    return {
      pathDirectness: 70, pathConnectivity: 60, surfaceContinuity: 80, crossingComplexity: 30,
      visualObstruction: 20, blindSpots: 15, noise: 35, crowding: 25, hardscape: 55, brightness: 60
    };
  }

  function defaultsForCat(cat) {
    switch (cat) {
      case "entrances": return { width: 3 };
      case "pathways": return { width: 2.5 };
      case "seats": return { type: "individual", groupSize: 1 };
      case "trees": return { canopy: 4 };
      case "shades": return { radius: 20, type: "pergola" };
      case "lights": return { brightness: 60 };
      case "water": return { radius: 10 };
      case "edges": return { type: "shop", length: 8 };
      case "nodes": return { type: "gathering" };
      case "obstacles": return { width: 6, height: 6 };
      default: return {};
    }
  }

  function clamp01(v) { return Utils.clamp(v, -0.08, 1.08); }

  function phyllotaxis(i, n, cx, cy, maxR) {
    const r = maxR * Math.sqrt((i + 0.5) / Math.max(1, n));
    const theta = i * 2.399963229728653; // golden angle (radians)
    return { x: clamp01(cx + r * Math.cos(theta)), y: clamp01(cy + r * Math.sin(theta)) };
  }

  function perimeterPoint(t) {
    t = ((t % 1) + 1) % 1;
    if (t < 0.25) return { x: t / 0.25, y: 0 };
    if (t < 0.5) return { x: 1, y: (t - 0.25) / 0.25 };
    if (t < 0.75) return { x: 1 - (t - 0.5) / 0.25, y: 1 };
    return { x: 0, y: 1 - (t - 0.75) / 0.25 };
  }

  function newObject(cat, pos) {
    return Object.assign({ id: Utils.uid(cat), x: pos.x, y: pos.y }, defaultsForCat(cat));
  }

  function placeNew(cat, index, total) {
    if (cat === "entrances" || cat === "edges") return perimeterPoint((index + 0.5) / Math.max(1, total));
    return phyllotaxis(index, total, 0.5, 0.5, 0.44);
  }

  function addObject(space, cat, pos) {
    const list = space.objects[cat];
    const p = pos || placeNew(cat, list.length, list.length + 1);
    const obj = newObject(cat, p);
    if (cat === "pathways") { obj.x1 = 0.15; obj.y1 = 0.15; obj.x2 = 0.85; obj.y2 = 0.85; delete obj.x; delete obj.y; }
    list.push(obj);
    return obj;
  }

  function setObjectCount(space, cat, n) {
    n = Math.max(0, Math.round(n));
    const list = space.objects[cat];
    if (n <= list.length) { list.length = n; return; }
    const start = list.length;
    for (let i = start; i < n; i++) {
      const pos = placeNew(cat, i, n);
      list.push(newObject(cat, pos));
    }
  }

  function getCount(space, cat) { return space.objects[cat].length; }

  function avgField(list, key, fallback) {
    if (!list.length) return fallback;
    const sum = list.reduce((a, o) => a + (typeof o[key] === "number" ? o[key] : fallback), 0);
    return sum / list.length;
  }

  function distinctCount(list, key) { return new Set(list.map(o => o[key])).size; }

  function circularSpread(points) {
    // points: array of {x,y} fractions in [0,1]; returns 0-100 (higher = more evenly distributed around centroid)
    if (points.length < 2) return 40;
    let sx = 0, sy = 0;
    points.forEach(p => {
      const ang = Math.atan2(p.y - 0.5, p.x - 0.5);
      sx += Math.cos(ang); sy += Math.sin(ang);
    });
    const n = points.length;
    const R = Math.sqrt(sx * sx + sy * sy) / n; // 0 = spread out, 1 = clustered
    return Utils.clamp((1 - R) * 100, 0, 100);
  }

  function avgNearestNeighborFrac(points) {
    // returns average nearest-neighbor distance in fraction-space units (0..~1.4)
    if (points.length < 2) return 1.2;
    let total = 0;
    points.forEach((p, i) => {
      let best = Infinity;
      points.forEach((q, j) => {
        if (i === j) return;
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < best) best = d;
      });
      total += best;
    });
    return total / points.length;
  }

  function defaultSpace() {
    return { geometry: defaultGeometry(), params: defaultParams(), timeCondition: "Afternoon", objects: emptyObjects() };
  }

  return {
    OBJ_CATS, SEAT_TYPES, NODE_TYPES, EDGE_TYPES, SHADE_TYPES,
    emptyObjects, defaultGeometry, defaultParams, defaultsForCat,
    phyllotaxis, perimeterPoint, addObject, setObjectCount, getCount,
    avgField, distinctCount, circularSpread, avgNearestNeighborFrac, defaultSpace, clamp01
  };
})();

/* ===================== PRESETS ===================== */
const Presets = (() => {
  function base() { return SpaceModel.defaultSpace(); }

  function fillCats(space, counts) {
    Object.keys(counts).forEach(cat => SpaceModel.setObjectCount(space, cat, counts[cat]));
  }

  const DEFS = {
    open: {
      label: "Open Plaza",
      desc: "A large, unobstructed open plaza with dispersed seating and minimal enclosure.",
      build() {
        const s = base();
        Object.assign(s.geometry, { width: 45, length: 65, openness: 88, enclosure: 12 });
        Object.assign(s.params, { pathDirectness: 85, pathConnectivity: 70, surfaceContinuity: 90, crossingComplexity: 15, visualObstruction: 8, blindSpots: 8, noise: 30, crowding: 18, hardscape: 78, brightness: 65 });
        fillCats(s, { entrances: 4, seats: 8, trees: 3, lights: 8, edges: 2, nodes: 1, obstacles: 0, water: 0 });
        return s;
      }
    },
    treelined: {
      label: "Tree-Lined Plaza",
      desc: "Dense tree canopy providing shade along circulation routes.",
      build() {
        const s = base();
        Object.assign(s.geometry, { width: 40, length: 70, openness: 60, enclosure: 30 });
        Object.assign(s.params, { pathDirectness: 75, pathConnectivity: 65, hardscape: 45, brightness: 55, noise: 25 });
        fillCats(s, { entrances: 3, seats: 12, trees: 20, lights: 10, edges: 2, nodes: 2, obstacles: 0, water: 0 });
        s.objects.trees.forEach(t => t.canopy = 5.5);
        return s;
      }
    },
    courtyard: {
      label: "Courtyard Plaza",
      desc: "Enclosed courtyard with restricted, controlled entry points.",
      build() {
        const s = base();
        Object.assign(s.geometry, { width: 28, length: 32, openness: 25, enclosure: 78 });
        Object.assign(s.params, { visualObstruction: 35, blindSpots: 30, crowding: 20, hardscape: 60 });
        fillCats(s, { entrances: 2, seats: 10, trees: 4, lights: 6, edges: 4, nodes: 1, obstacles: 2, water: 1 });
        s.objects.edges.forEach((e, i) => e.type = i < 3 ? "blank" : "transparent");
        return s;
      }
    },
    seating: {
      label: "Seating-Centered Plaza",
      desc: "High seating density arranged in clustered groups around a central gathering node.",
      build() {
        const s = base();
        Object.assign(s.geometry, { width: 38, length: 50, openness: 55, enclosure: 35 });
        Object.assign(s.params, { pathConnectivity: 90 });
        fillCats(s, { entrances: 4, seats: 26, trees: 8, lights: 10, edges: 3, nodes: 2, obstacles: 0, water: 1 });
        s.objects.seats.forEach(st => st.type = "clustered");
        s.objects.nodes.forEach(n => n.type = "gathering");
        return s;
      }
    },
    commercial: {
      label: "Commercial Edge Plaza",
      desc: "Active commercial frontage (shops/cafes) framing a pedestrian plaza.",
      build() {
        const s = base();
        Object.assign(s.geometry, { width: 40, length: 55, openness: 65, enclosure: 30 });
        Object.assign(s.params, { crowding: 45, noise: 50 });
        fillCats(s, { entrances: 5, seats: 14, trees: 5, lights: 12, edges: 8, nodes: 3, obstacles: 0, water: 0 });
        s.objects.edges.forEach((e, i) => e.type = i % 4 === 0 ? "cafe" : "shop");
        s.objects.nodes[0] && (s.objects.nodes[0].type = "food");
        return s;
      }
    },
    park: {
      label: "Park-Like Space",
      desc: "Loosely structured green space with high vegetation and low hardscape ratio.",
      build() {
        const s = base();
        Object.assign(s.geometry, { width: 55, length: 80, openness: 70, enclosure: 15 });
        Object.assign(s.params, { hardscape: 22, noise: 15, crowding: 10 });
        fillCats(s, { entrances: 3, seats: 10, trees: 32, lights: 6, edges: 1, nodes: 3, obstacles: 3, water: 1 });
        s.objects.trees.forEach(t => t.canopy = 6);
        return s;
      }
    },
    highdensity: {
      label: "High-Density Urban Plaza",
      desc: "Compact, intensively used urban plaza with high pedestrian and seating density.",
      build() {
        const s = base();
        Object.assign(s.geometry, { width: 25, length: 35, openness: 45, enclosure: 55 });
        Object.assign(s.params, { pathConnectivity: 95, crossingComplexity: 70, noise: 70, crowding: 75, brightness: 80 });
        fillCats(s, { entrances: 5, seats: 16, trees: 4, lights: 14, edges: 6, nodes: 3, obstacles: 2, water: 0 });
        s.objects.seats.forEach(st => st.type = "clustered");
        return s;
      }
    },
    lowdensity: {
      label: "Low-Density Quiet Plaza",
      desc: "Sparse, quiet space intended for passive, low-intensity use.",
      build() {
        const s = base();
        Object.assign(s.geometry, { width: 40, length: 50, openness: 60, enclosure: 25 });
        Object.assign(s.params, { noise: 10, crowding: 5, pathConnectivity: 40 });
        fillCats(s, { entrances: 2, seats: 4, trees: 6, lights: 4, edges: 1, nodes: 1, obstacles: 0, water: 0 });
        s.objects.nodes.forEach(n => n.type = "quiet");
        s.objects.seats.forEach(st => st.type = "individual");
        return s;
      }
    },
    pedestrian: {
      label: "Pedestrian Plaza",
      desc: "Car-free pedestrian-priority plaza with highly direct, well-connected circulation.",
      build() {
        const s = base();
        Object.assign(s.geometry, { width: 30, length: 90, openness: 80, enclosure: 20 });
        Object.assign(s.params, { pathDirectness: 95, crossingComplexity: 10, hardscape: 70 });
        fillCats(s, { entrances: 6, seats: 14, trees: 10, lights: 12, edges: 6, nodes: 2, obstacles: 0, water: 0 });
        return s;
      }
    }
  };

  function list() { return Object.keys(DEFS).map(k => ({ key: k, label: DEFS[k].label, desc: DEFS[k].desc })); }
  function build(key) { return DEFS[key] ? DEFS[key].build() : null; }
  function describe(key) { return DEFS[key] ? DEFS[key].desc : ""; }

  return { list, build, describe };
})();

/* ===================== METRICS =====================
   Computes transparent, deterministic 0-100 base metrics from the
   current space configuration. Every metric here is a MODEL-BASED /
   SIMULATION construct, not an empirical measurement. */
const Metrics = (() => {
  const C = Utils.clamp;

  function compute(space) {
    const g = space.geometry, p = space.params, o = space.objects;
    const raw = {}, val = {};

    function set(key, rawValue, normValue, unit, desc) {
      raw[key] = { raw: rawValue, unit: unit || "", desc: desc || "" };
      val[key] = C(normValue, 0, 100);
    }

    // --- Entrances / Accessibility inputs ---
    const entranceCount = o.entrances.length;
    const avgEntranceWidth = SpaceModel.avgField(o.entrances, "width", 3);
    const entranceDistribution = SpaceModel.circularSpread(o.entrances);
    set("entranceCount", entranceCount, Math.min(100, entranceCount * 20), "count", "Number of entrances");
    set("entranceWidth", avgEntranceWidth, Math.min(100, avgEntranceWidth * 12), "m (avg)", "Average entrance width");
    set("entranceDistribution", entranceDistribution, entranceDistribution, "0-100", "Even distribution of entrances around the perimeter (circular spread)");
    val.entranceAccessComposite = C(val.entranceCount * 0.5 + val.entranceWidth * 0.3 + val.entranceDistribution * 0.2, 0, 100);
    raw.entranceAccessComposite = { raw: val.entranceAccessComposite.toFixed(1), unit: "0-100", desc: "50% count + 30% width + 20% distribution" };

    // --- Pathways / Walkability ---
    const pathCount = o.pathways.length;
    const avgPathWidth = SpaceModel.avgField(o.pathways, "width", 2.5);
    set("pathCount", pathCount, Math.min(100, pathCount * 14), "count", "Number of pathways");
    set("pathWidth", avgPathWidth, Math.min(100, avgPathWidth * 20), "m (avg)", "Average pathway width");
    set("pathConnectivity", p.pathConnectivity, p.pathConnectivity, "0-100 (param)", "Researcher-set path connectivity parameter");
    set("pathDirectness", p.pathDirectness, p.pathDirectness, "0-100 (param)", "Researcher-set path directness parameter");
    set("surfaceContinuity", p.surfaceContinuity, p.surfaceContinuity, "0-100 (param)", "Researcher-set surface continuity parameter");
    set("crossingComplexity", p.crossingComplexity, p.crossingComplexity, "0-100 (param)", "Researcher-set crossing complexity parameter");

    // --- Obstacles / Barriers ---
    const obstacleCount = o.obstacles.length;
    set("obstacleDensity", obstacleCount, Math.min(100, obstacleCount * 12), "count", "Number of obstacles / barriers");

    // --- Visibility ---
    set("visualObstruction", p.visualObstruction, p.visualObstruction, "0-100 (param)", "Researcher-set visual obstruction parameter");
    set("blindSpots", p.blindSpots, p.blindSpots, "0-100 (param)", "Researcher-set blind-spot parameter");
    const sightline = 100 - g.enclosure * 0.5 - p.visualObstruction * 0.3;
    set("sightlineLength", sightline.toFixed(1), sightline, "0-100 (derived)", "100 − 0.5×enclosure − 0.3×visual obstruction");
    set("entranceVisibility", null, 100 - p.visualObstruction * 0.6, "0-100 (derived)", "100 − 0.6×visual obstruction");

    // --- Lighting ---
    const lightCount = o.lights.length;
    const lightingScore = lightCount * 10 + p.brightness * 0.4;
    set("lighting", lightCount, lightingScore, "count + brightness", "Lights count ×10 + 0.4×brightness parameter");

    // --- Active edges ---
    const edgeTotal = o.edges.length;
    const activeEdgeCount = o.edges.filter(e => e.type !== "blank").length;
    const edgeTransparency = edgeTotal === 0 ? 50 : (activeEdgeCount / edgeTotal) * 100;
    set("activeEdges", activeEdgeCount, Math.min(100, activeEdgeCount * 18), "count", "Non-blank (active) edge segments");
    set("edgeTransparency", edgeTotal ? (activeEdgeCount + "/" + edgeTotal) : "n/a", edgeTransparency, "% active", "Share of edges that are active/transparent vs blank");

    // --- Safety-related composites (computed after visibility index; see Indicators) ---
    const surveillance = val.lighting !== undefined ? (lightingScore > 100 ? 100 : lightingScore) * 0.4 + Math.min(100, activeEdgeCount * 18) * 0.4 + (100 - g.enclosure) * 0.2 : 0;
    set("surveillance", null, surveillance, "0-100 (derived)", "0.4×lighting + 0.4×active edges + 0.2×(100−enclosure)");
    set("enclosure", g.enclosure, g.enclosure, "0-100 (param)", "Researcher-set enclosure level");

    // --- Seating / Social interaction ---
    const seatPts = o.seats.map(s => ({ x: s.x, y: s.y }));
    const nnDist = SpaceModel.avgNearestNeighborFrac(seatPts);
    const clustering = seatPts.length < 2 ? 20 : C(100 * (1 - Math.min(nnDist, 0.32) / 0.32), 0, 100);
    set("seatingClustering", nnDist.toFixed(3), clustering, "0-100 (derived)", "Inverse of average nearest-neighbor distance between seats (fraction-space units)");
    set("seatingSeparation", null, 100 - clustering, "0-100 (derived)", "100 − seating clustering");
    set("seatingAvailability", o.seats.length, Math.min(100, o.seats.length * 6), "count", "Number of seating elements");
    set("seatingTypes", SpaceModel.distinctCount(o.seats, "type"), (SpaceModel.distinctCount(o.seats, "type") / 6) * 100, "distinct/6", "Distinct seating types in use");

    const nodeCount = o.nodes.length;
    set("activityNodes", nodeCount, Math.min(100, nodeCount * 15), "count", "Number of activity nodes");
    set("activityZoneCount", nodeCount, Math.min(100, nodeCount * 15), "count", "Number of distinct activity zones");
    set("activityTypeDiversity", SpaceModel.distinctCount(o.nodes, "type"), (SpaceModel.distinctCount(o.nodes, "type") / 6) * 100, "distinct/6", "Distinct activity node types in use");

    const pathIntersection = pathCount * 12 + p.pathConnectivity * 0.2;
    set("pathIntersection", pathCount, pathIntersection, "0-100 (derived)", "Pathway count ×12 + 0.2×path connectivity");

    const gatheringNodes = o.nodes.filter(n => n.type === "gathering").length;
    const gatheringCapacity = gatheringNodes * 30 + o.seats.length * 3;
    set("gatheringCapacity", gatheringNodes, gatheringCapacity, "0-100 (derived)", "Gathering nodes ×30 + seats ×3");

    const recreationCultural = o.nodes.filter(n => ["playground", "performance", "exercise"].includes(n.type)).length * 20;
    set("recreationCultural", null, recreationCultural, "0-100 (derived)", "Recreation/cultural activity nodes ×20");
    set("commercialActivity", null, Math.min(100, activeEdgeCount * 18), "0-100 (derived)", "Proxy: active edge score");
    set("pedestrianMovement", null, pathIntersection, "0-100 (derived)", "Proxy: path intersection score");

    // --- Vegetation / Shade / Comfort ---
    const treeCount = o.trees.length;
    const avgCanopy = SpaceModel.avgField(o.trees, "canopy", 4);
    const shadeCount = o.shades.length;
    const shadeScore = shadeCount * 10 + treeCount * avgCanopy * 0.5;
    set("shade", treeCount + shadeCount, shadeScore, "0-100 (derived)", "Shade structures ×10 + trees×avg canopy×0.5");
    set("vegetation", treeCount, Math.min(100, treeCount * 8), "count", "Number of trees");

    set("noise", p.noise, p.noise, "0-100 (param)", "Researcher-set / scenario noise assumption");
    set("crowding", p.crowding, p.crowding, "0-100 (param)", "Researcher-set / scenario crowding assumption");
    const waterCount = o.water.length;
    set("water", waterCount, Math.min(100, waterCount * 25), "count", "Number of water features");

    const visualScreening = treeCount * 4 + shadeCount * 4 + g.enclosure * 0.3;
    set("visualScreening", null, visualScreening, "0-100 (derived)", "Trees×4 + shade×4 + 0.3×enclosure");
    set("distanceFromCirculation", null, 100 - p.pathConnectivity * 0.4, "0-100 (derived)", "100 − 0.4×path connectivity");

    set("hardscape", p.hardscape, p.hardscape, "0-100 (param)", "Researcher-set hardscape ratio");
    set("openArea", null, 100 - p.hardscape, "0-100 (derived)", "100 − hardscape ratio");

    return { raw, val };
  }

  return { compute };
})();

/* ===================== INDICATOR DEFINITIONS ===================== */
const IndicatorDefs = [
  {
    id: "accessibility", label: "Accessibility Index", cat: "A",
    def: "Model-based estimate of ease of physical entry and movement into the space.",
    components: [
      { key: "entranceAccess", label: "Entrance Accessibility", metric: "entranceAccessComposite", weight: 0.40 },
      { key: "pathConnectivity", label: "Path Connectivity", metric: "pathConnectivity", weight: 0.30 },
      { key: "pathDirectness", label: "Path Directness", metric: "pathDirectness", weight: 0.20 },
      { key: "barrierPenalty", label: "Barrier Penalty (inverted)", metric: "obstacleDensity", weight: 0.10, invert: true }
    ]
  },
  {
    id: "walkability", label: "Walkability Index", cat: "B",
    def: "Model-based estimate of ease of pedestrian movement through the space.",
    components: [
      { key: "pathWidth", label: "Path Width", metric: "pathWidth", weight: 0.25 },
      { key: "pathDirectness", label: "Path Directness", metric: "pathDirectness", weight: 0.25 },
      { key: "surfaceContinuity", label: "Surface Continuity", metric: "surfaceContinuity", weight: 0.20 },
      { key: "obstacleDensity", label: "Obstacle Density (inverted)", metric: "obstacleDensity", weight: 0.15, invert: true },
      { key: "crossingComplexity", label: "Crossing Complexity (inverted)", metric: "crossingComplexity", weight: 0.15, invert: true }
    ]
  },
  {
    id: "visibility", label: "Visibility Index", cat: "C",
    def: "Model-based estimate of sightline quality and openness of view.",
    components: [
      { key: "sightlineLength", label: "Sightline Length", metric: "sightlineLength", weight: 0.25 },
      { key: "visualObstruction", label: "Visual Obstruction (inverted)", metric: "visualObstruction", weight: 0.25, invert: true },
      { key: "lighting", label: "Lighting", metric: "lighting", weight: 0.20 },
      { key: "edgeTransparency", label: "Edge Transparency", metric: "edgeTransparency", weight: 0.15 },
      { key: "entranceVisibility", label: "Entrance Visibility", metric: "entranceVisibility", weight: 0.15 }
    ]
  },
  {
    id: "safety", label: "Perceived Safety Potential", cat: "D", note: "Model-based safety indicator — not an objective measurement of actual safety.",
    def: "Model-based estimate of spatial characteristics associated with passive surveillance and perceived safety.",
    components: [
      { key: "lighting", label: "Lighting", metric: "lighting", weight: 0.25 },
      { key: "visibilityIndex", label: "Visibility Index (computed)", metric: "__visibility__", weight: 0.20 },
      { key: "activeEdges", label: "Active Edges", metric: "activeEdges", weight: 0.20 },
      { key: "surveillance", label: "Passive Surveillance Potential", metric: "surveillance", weight: 0.15 },
      { key: "enclosure", label: "Enclosure (inverted)", metric: "enclosure", weight: 0.10, invert: true },
      { key: "blindSpots", label: "Blind Spots (inverted)", metric: "blindSpots", weight: 0.10, invert: true }
    ]
  },
  {
    id: "social", label: "Social Interaction Potential", cat: "E",
    def: "Model-based estimate of spatial characteristics associated with opportunities for social interaction.",
    components: [
      { key: "seatingClustering", label: "Seating Clustering", metric: "seatingClustering", weight: 0.30 },
      { key: "activityNodes", label: "Activity Nodes", metric: "activityNodes", weight: 0.20 },
      { key: "pathIntersection", label: "Path Intersection", metric: "pathIntersection", weight: 0.20 },
      { key: "gatheringCapacity", label: "Gathering Capacity", metric: "gatheringCapacity", weight: 0.15 },
      { key: "activeEdgePotential", label: "Active Edge Potential", metric: "activeEdges", weight: 0.15 }
    ]
  },
  {
    id: "comfort", label: "Environmental Comfort Index", cat: "F",
    def: "Model-based estimate of environmental conditions supporting comfortable occupancy.",
    components: [
      { key: "shade", label: "Shade", metric: "shade", weight: 0.25 },
      { key: "vegetation", label: "Vegetation", metric: "vegetation", weight: 0.20 },
      { key: "seatingAvailability", label: "Seating Availability", metric: "seatingAvailability", weight: 0.20 },
      { key: "noise", label: "Noise (inverted)", metric: "noise", weight: 0.15, invert: true },
      { key: "crowding", label: "Crowding (inverted)", metric: "crowding", weight: 0.10, invert: true },
      { key: "water", label: "Water Features", metric: "water", weight: 0.10 }
    ]
  },
  {
    id: "privacy", label: "Privacy Potential", cat: "G",
    def: "Model-based estimate of spatial conditions supporting personal or small-group privacy.",
    components: [
      { key: "seatingSeparation", label: "Seating Separation", metric: "seatingSeparation", weight: 0.30 },
      { key: "visualScreening", label: "Visual Screening", metric: "visualScreening", weight: 0.25 },
      { key: "enclosure", label: "Enclosure", metric: "enclosure", weight: 0.20 },
      { key: "distanceFromCirculation", label: "Distance from Circulation", metric: "distanceFromCirculation", weight: 0.25 }
    ]
  },
  {
    id: "sociability", label: "Sociability Index", cat: "H",
    def: "Model-based estimate of the space's overall capacity to support public sociability.",
    components: [
      { key: "activeEdges", label: "Active Edges", metric: "activeEdges", weight: 0.25 },
      { key: "seatingAvailability", label: "Seating", metric: "seatingAvailability", weight: 0.25 },
      { key: "activityTypeDiversity", label: "Activity Diversity", metric: "activityTypeDiversity", weight: 0.20 },
      { key: "gatheringCapacity", label: "Gathering Spaces", metric: "gatheringCapacity", weight: 0.15 },
      { key: "pedestrianMovement", label: "Pedestrian Movement", metric: "pedestrianMovement", weight: 0.15 }
    ]
  },
  {
    id: "thermal", label: "Thermal Comfort Potential", cat: "I", note: "Simulation indicator — not a measured thermal comfort value.",
    def: "Model-based estimate of environmental conditions associated with thermal comfort.",
    components: [
      { key: "shade", label: "Shade", metric: "shade", weight: 0.30 },
      { key: "vegetation", label: "Vegetation", metric: "vegetation", weight: 0.25 },
      { key: "water", label: "Water", metric: "water", weight: 0.15 },
      { key: "openArea", label: "Open Area", metric: "openArea", weight: 0.15 },
      { key: "hardscape", label: "Hardscape Ratio (inverted)", metric: "hardscape", weight: 0.15, invert: true }
    ]
  },
  {
    id: "activityDiversity", label: "Activity Diversity Index", cat: "J",
    def: "Model-based estimate of the range and variety of activity opportunities in the space.",
    components: [
      { key: "activityZoneCount", label: "Number of Activity Zones", metric: "activityZoneCount", weight: 0.30 },
      { key: "activityTypeDiversity", label: "Activity Type Diversity", metric: "activityTypeDiversity", weight: 0.25 },
      { key: "seatingTypes", label: "Seating Types", metric: "seatingTypes", weight: 0.15 },
      { key: "commercialActivity", label: "Commercial Activity", metric: "commercialActivity", weight: 0.15 },
      { key: "recreationCultural", label: "Recreation / Cultural Activity", metric: "recreationCultural", weight: 0.15 }
    ]
  }
];

const COMPOSITE_KEYS = ["accessibility", "walkability", "visibility", "safety", "social", "comfort", "privacy", "sociability", "activityDiversity", "environmental"];

/* ===================== WEIGHTS MANAGER ===================== */
const WeightsManager = (() => {
  function defaultIndicatorWeights() {
    const w = {};
    IndicatorDefs.forEach(ind => {
      w[ind.id] = {};
      ind.components.forEach(c => { w[ind.id][c.key] = c.weight; });
    });
    return w;
  }
  function defaultCompositeWeights() {
    const w = {};
    COMPOSITE_KEYS.forEach(k => w[k] = 1 / COMPOSITE_KEYS.length);
    return w;
  }
  function defaultWeights() { return { indicators: defaultIndicatorWeights(), composite: defaultCompositeWeights() }; }

  function normalizeGroup(group) {
    const sum = Object.values(group).reduce((a, b) => a + (Number(b) || 0), 0);
    if (sum <= 0) return group;
    const out = {};
    Object.keys(group).forEach(k => out[k] = group[k] / sum);
    return out;
  }
  function normalizeAll(weights) {
    const out = { indicators: {}, composite: normalizeGroup(weights.composite) };
    Object.keys(weights.indicators).forEach(id => { out.indicators[id] = normalizeGroup(weights.indicators[id]); });
    return out;
  }

  return { defaultWeights, normalizeGroup, normalizeAll };
})();

/* ===================== CALC ENGINE ===================== */
const CalcEngine = (() => {
  function computeIndicator(def, metricsVal, weightsForInd, visibilityScore) {
    let score = 0;
    const breakdown = [];
    def.components.forEach(c => {
      let v = c.metric === "__visibility__" ? visibilityScore : (metricsVal[c.metric] !== undefined ? metricsVal[c.metric] : 0);
      const used = c.invert ? (100 - v) : v;
      const weight = (weightsForInd && weightsForInd[c.key] !== undefined) ? weightsForInd[c.key] : c.weight;
      const contribution = used * weight;
      score += contribution;
      breakdown.push({ label: c.label, metricKey: c.metric, rawNormalized: Utils.round1(v), invert: !!c.invert, usedValue: Utils.round1(used), weight: Utils.round1(weight * 100) / 100, contribution: Utils.round1(contribution) });
    });
    return { score: Utils.clamp(score, 0, 100), breakdown };
  }

  function computeIndicators(space, weights) {
    const m = Metrics.compute(space);
    const w = weights || WeightsManager.defaultWeights();
    const indicators = {};

    // visibility must be computed before safety (dependency)
    const visDef = IndicatorDefs.find(d => d.id === "visibility");
    indicators.visibility = computeIndicator(visDef, m.val, w.indicators.visibility, 0);

    IndicatorDefs.forEach(def => {
      if (def.id === "visibility") return;
      indicators[def.id] = computeIndicator(def, m.val, w.indicators[def.id], indicators.visibility.score);
    });

    // Environmental Quality = average of Comfort + Thermal (not a standalone weighted formula card, derived)
    const environmentalScore = (indicators.comfort.score + indicators.thermal.score) / 2;
    indicators.environmental = {
      score: Utils.clamp(environmentalScore, 0, 100),
      breakdown: [
        { label: "Environmental Comfort Index", metricKey: "comfort", rawNormalized: Utils.round1(indicators.comfort.score), invert: false, usedValue: Utils.round1(indicators.comfort.score), weight: 0.5, contribution: Utils.round1(indicators.comfort.score * 0.5) },
        { label: "Thermal Comfort Potential", metricKey: "thermal", rawNormalized: Utils.round1(indicators.thermal.score), invert: false, usedValue: Utils.round1(indicators.thermal.score), weight: 0.5, contribution: Utils.round1(indicators.thermal.score * 0.5) }
      ]
    };

    // Composite Public Space Quality Score
    let compositeScore = 0;
    const compositeBreakdown = [];
    COMPOSITE_KEYS.forEach(k => {
      const weight = (w.composite && w.composite[k] !== undefined) ? w.composite[k] : 1 / COMPOSITE_KEYS.length;
      const s = indicators[k] ? indicators[k].score : 0;
      compositeScore += s * weight;
      compositeBreakdown.push({ id: k, label: indicatorLabel(k), score: Utils.round1(s), weight: Utils.round1(weight * 100) / 100, contribution: Utils.round1(s * weight) });
    });

    return { metrics: m, indicators, composite: { score: Utils.clamp(compositeScore, 0, 100), breakdown: compositeBreakdown } };
  }

  function indicatorLabel(id) {
    if (id === "environmental") return "Environmental Quality";
    const d = IndicatorDefs.find(x => x.id === id);
    return d ? d.label : id;
  }

  function indicatorDef(id) { return IndicatorDefs.find(d => d.id === id); }

  return { computeIndicators, indicatorLabel, indicatorDef };
})();

/* ===================== STATS ENGINE ===================== */
const StatsEngine = (() => {
  function describe(arr) {
    if (!arr.length) return { n: 0, mean: 0, median: 0, sd: 0, min: 0, max: 0, range: 0 };
    return {
      n: arr.length, mean: Utils.round1(Utils.mean(arr)), median: Utils.round1(Utils.median(arr)),
      sd: Utils.round1(Utils.sd(arr)), min: Utils.round1(Math.min(...arr)), max: Utils.round1(Math.max(...arr)),
      range: Utils.round1(Math.max(...arr) - Math.min(...arr))
    };
  }
  function meanDifference(a, b) { return Utils.round1(Utils.mean(b) - Utils.mean(a)); }
  function pctChange(a, b) {
    const ma = Utils.mean(a);
    if (ma === 0) return null;
    return Utils.round1(((Utils.mean(b) - ma) / Math.abs(ma)) * 100);
  }
  function pooledSD(a, b) {
    const na = a.length, nb = b.length;
    if (na < 2 && nb < 2) return 0;
    const va = na > 1 ? Utils.sd(a) ** 2 : 0, vb = nb > 1 ? Utils.sd(b) ** 2 : 0;
    const dfA = Math.max(na - 1, 0), dfB = Math.max(nb - 1, 0);
    const df = dfA + dfB;
    if (df === 0) return 0;
    return Math.sqrt((dfA * va + dfB * vb) / df);
  }
  function standardizedMeanDifference(a, b) {
    const ps = pooledSD(a, b);
    if (ps === 0) return null;
    return Utils.round1((Utils.mean(b) - Utils.mean(a)) / ps);
  }
  return { describe, meanDifference, pctChange, pooledSD, standardizedMeanDifference, pearson: Utils.pearson };
})();

/* ===================== STATE / STORE ===================== */
const STORAGE_KEY = "psrl_project_v1";
const MODEL_VERSION = "PSRL-Model v1.0";

function defaultQuestions() {
  return [
    { id: Utils.uid("q"), text: "I feel safe in this space." },
    { id: Utils.uid("q"), text: "This space is comfortable." },
    { id: Utils.uid("q"), text: "This space encourages social interaction." },
    { id: Utils.uid("q"), text: "This space is easy to navigate." },
    { id: Utils.uid("q"), text: "I would like to spend time here." },
    { id: Utils.uid("q"), text: "I would visit this space again." }
  ];
}

function defaultState() {
  return {
    version: 1,
    studyId: Utils.uid("STUDY"),
    study: {
      title: "", question: "", objective: "", hypothesis: "", type: "Experimental",
      iv: "", dv: "", controls: "", context: "", notes: ""
    },
    space: Presets.build("open"),
    spaceSeed: 12345,
    weights: WeightsManager.defaultWeights(),
    customWeightsEnabled: false,
    conditions: { baseline: null, treatment: null, list: [] },
    lockedControls: [],
    experiments: [],
    activeExperimentId: null,
    observations: [],
    participants: { questions: defaultQuestions(), responses: [], nextIndex: 1 },
    snapshots: [],
    dataset: [],
    log: [],
    workflow: { rq: false, variables: true, baseline: false, treatment: false, locked: false, experimentRun: false, observations: false, analyzed: false, exported: false, report: false },
    settings: { stochasticEnabled: false, stochasticLevel: 5 },
    spaceHistory: { stack: [], redo: [] },
    selection: null,
    editingCondition: null
  };
}

const Store = (() => {
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (e) {
      console.warn("Store.load failed", e);
      return null;
    }
  }
  const save = Utils.debounce(function (state) {
    try {
      const persist = Utils.deepClone(state);
      delete persist.spaceHistory;
      delete persist.selection;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    } catch (e) {
      Utils.toast("Could not save to local storage (storage may be full).", "error");
    }
  }, 350);
  function clear() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }
  return { load, save, clear };
})();

/* ===================== GLOBAL APP STATE HOLDER ===================== */
const App = { state: null, rng: null };

function markDirty() { Store.save(App.state); }

/* ===================== LOG MANAGER ===================== */
const LogManager = (() => {
  function add(action, variable, oldValue, newValue, experimentId, trial) {
    App.state.log.push({
      timestamp: Utils.nowISO(), action, variable: variable || "", oldValue: oldValue !== undefined ? String(oldValue) : "",
      newValue: newValue !== undefined ? String(newValue) : "", experimentId: experimentId || (App.state.activeExperimentId || ""), trial: trial || ""
    });
    if (App.state.log.length > 500) App.state.log.shift();
    markDirty();
  }
  function exportCSV() {
    const header = ["timestamp", "action", "variable", "old_value", "new_value", "experiment_id", "trial"];
    const rows = App.state.log.map(l => [l.timestamp, l.action, l.variable, l.oldValue, l.newValue, l.experimentId, l.trial]);
    const csv = [header.join(",")].concat(rows.map(r => r.map(Utils.csvEscape).join(","))).join("\n");
    Utils.download("experiment_log.csv", csv, "text/csv");
  }
  return { add, exportCSV };
})();

/* ===================== DATASET MANAGER ===================== */
const DatasetManager = (() => {
  const COLUMNS = ["study_id", "experiment_id", "trial", "condition", "independent_variable", "independent_value", "dependent_variable", "dependent_value", "timestamp", "observation_type", "participant_id", "notes"];

  function addRow(fields) {
    const row = Object.assign({
      id: Utils.uid("row"), study_id: App.state.studyId, experiment_id: App.state.activeExperimentId || "",
      trial: "", condition: "", independent_variable: "", independent_value: "", dependent_variable: "",
      dependent_value: "", timestamp: Utils.nowISO(), observation_type: "simulation", participant_id: "", notes: ""
    }, fields);
    App.state.dataset.push(row);
    markDirty();
    return row;
  }
  function deleteRow(id) { App.state.dataset = App.state.dataset.filter(r => r.id !== id); markDirty(); }
  function duplicateRow(id) {
    const r = App.state.dataset.find(x => x.id === id);
    if (!r) return;
    const copy = Utils.deepClone(r); copy.id = Utils.uid("row"); copy.timestamp = Utils.nowISO();
    App.state.dataset.push(copy); markDirty();
  }
  function updateRow(id, fields) {
    const r = App.state.dataset.find(x => x.id === id);
    if (!r) return;
    Object.assign(r, fields); markDirty();
  }
  function clearAll() { App.state.dataset = []; markDirty(); }
  function query(opts) {
    opts = opts || {};
    let rows = App.state.dataset.slice();
    if (opts.type) rows = rows.filter(r => r.observation_type === opts.type);
    if (opts.search) {
      const s = opts.search.toLowerCase();
      rows = rows.filter(r => COLUMNS.some(c => String(r[c] || "").toLowerCase().includes(s)));
    }
    if (opts.sort) {
      rows.sort((a, b) => {
        const av = a[opts.sort], bv = b[opts.sort];
        const an = Number(av), bn = Number(bv);
        if (!isNaN(an) && !isNaN(bn) && av !== "" && bv !== "") return an - bn;
        return String(av).localeCompare(String(bv));
      });
    }
    return rows;
  }
  function numericValues(type) {
    return App.state.dataset.filter(r => (!type || r.observation_type === type) && r.dependent_value !== "" && !isNaN(Number(r.dependent_value))).map(r => Number(r.dependent_value));
  }
  function exportCSV() {
    const header = COLUMNS;
    const rows = App.state.dataset.map(r => header.map(c => Utils.csvEscape(r[c])).join(","));
    const csv = [header.join(",")].concat(rows).join("\n");
    Utils.download("psrl_dataset.csv", csv, "text/csv");
    App.state.workflow.exported = true; markDirty();
  }
  function exportJSON() {
    Utils.download("psrl_dataset.json", JSON.stringify(App.state.dataset, null, 2), "application/json");
    App.state.workflow.exported = true; markDirty();
  }
  return { COLUMNS, addRow, deleteRow, duplicateRow, updateRow, clearAll, query, numericValues, exportCSV, exportJSON };
})();

/* ===================== OBSERVATION MANAGER ===================== */
const ObservationManager = (() => {
  function add(fields) {
    const obs = Object.assign({ id: Utils.uid("obs"), timestamp: Utils.nowISO() }, fields);
    App.state.observations.push(obs);
    DatasetManager.addRow({
      condition: obs.condition || "", independent_variable: "condition", independent_value: obs.condition || "",
      dependent_variable: "Observed Social Interactions", dependent_value: obs.interactions || 0,
      observation_type: "observation", notes: obs.notes || "", timestamp: obs.timestamp
    });
    App.state.workflow.observations = true;
    markDirty();
    return obs;
  }
  function list() { return App.state.observations.slice().reverse(); }
  return { add, list };
})();

/* ===================== PARTICIPANT MANAGER ===================== */
const ParticipantManager = (() => {
  function addQuestion(text) {
    if (!text || !text.trim()) return;
    App.state.participants.questions.push({ id: Utils.uid("q"), text: text.trim() });
    markDirty();
  }
  function removeQuestion(id) {
    App.state.participants.questions = App.state.participants.questions.filter(q => q.id !== id);
    markDirty();
  }
  function nextParticipantId() {
    const n = App.state.participants.nextIndex || 1;
    return "P" + String(n).padStart(3, "0");
  }
  function addResponse(participantId, condition, answers) {
    const resp = { id: Utils.uid("resp"), participantId, condition: condition || "", answers, timestamp: Utils.nowISO() };
    App.state.participants.responses.push(resp);
    App.state.participants.nextIndex = (App.state.participants.nextIndex || 1) + 1;
    App.state.participants.questions.forEach(q => {
      if (answers[q.id] === undefined || answers[q.id] === null) return;
      DatasetManager.addRow({
        condition: condition || "", independent_variable: "condition", independent_value: condition || "",
        dependent_variable: q.text, dependent_value: answers[q.id], observation_type: "participant",
        participant_id: participantId, timestamp: resp.timestamp
      });
    });
    App.state.workflow.observations = true;
    markDirty();
    return resp;
  }
  function questionStats(questionId) {
    const vals = App.state.participants.responses.map(r => r.answers[questionId]).filter(v => v !== undefined && v !== null).map(Number);
    const dist = [0, 0, 0, 0, 0];
    vals.forEach(v => { if (v >= 1 && v <= 5) dist[v - 1]++; });
    return Object.assign(StatsEngine.describe(vals), { dist });
  }
  return { addQuestion, removeQuestion, nextParticipantId, addResponse, questionStats };
})();

/* ===================== SNAPSHOT MANAGER ===================== */
const SnapshotManager = (() => {
  function save(name) {
    const snap = { id: Utils.uid("snap"), name: name || ("Snapshot " + (App.state.snapshots.length + 1)), timestamp: Utils.nowISO(), space: Utils.deepClone(App.state.space) };
    App.state.snapshots.push(snap);
    LogManager.add("Snapshot saved", "space", "", snap.name);
    markDirty();
    return snap;
  }
  function restore(id) {
    const snap = App.state.snapshots.find(s => s.id === id);
    if (!snap) return false;
    SpaceHistory.beginEdit();
    App.state.space = Utils.deepClone(snap.space);
    SpaceHistory.commitEdit();
    LogManager.add("Snapshot restored", "space", "", snap.name);
    markDirty();
    return true;
  }
  function remove(id) { App.state.snapshots = App.state.snapshots.filter(s => s.id !== id); markDirty(); }
  function list() { return App.state.snapshots.slice(); }
  return { save, restore, remove, list };
})();

/* ===================== EXPERIMENT ENGINE ===================== */
const ExperimentEngine = (() => {
  const VAR_CAT_MAP = { treeCount: "trees", seatCount: "seats", entranceCount: "entrances", lightCount: "lights" };
  const VAR_PARAM_MAP = { parPathDirectness: "pathDirectness", parHardscape: "hardscape" };
  const VAR_LABELS = { treeCount: "Tree Count", seatCount: "Seating Count", entranceCount: "Entrance Count", lightCount: "Lighting Count", parPathDirectness: "Path Directness", parHardscape: "Hardscape Ratio" };

  function getVarValue(space, varKey) {
    if (VAR_CAT_MAP[varKey]) return SpaceModel.getCount(space, VAR_CAT_MAP[varKey]);
    if (VAR_PARAM_MAP[varKey]) return space.params[VAR_PARAM_MAP[varKey]];
    return 0;
  }
  function setVarValue(space, varKey, value) {
    if (VAR_CAT_MAP[varKey]) { SpaceModel.setObjectCount(space, VAR_CAT_MAP[varKey], value); return; }
    if (VAR_PARAM_MAP[varKey]) { space.params[VAR_PARAM_MAP[varKey]] = Utils.clamp(value, 0, 100); return; }
  }
  function varLabel(varKey) { return VAR_LABELS[varKey] || varKey; }

  const DV_KEYWORDS = [
    ["social", "sociab", "interaction"], ["access", "accessibility"], ["comfort", "thermal"],
    ["safe", "safety"], ["privacy", "private"], ["walk", "walkab"], ["visib", "sightline"],
    ["diversity", "activity"]
  ];
  const DV_KEY_TO_IND = { social: "social", access: "accessibility", comfort: "comfort", safe: "safety", privacy: "privacy", walk: "walkability", visib: "visibility", diversity: "activityDiversity" };
  function guessIndicatorFromText(text) {
    if (!text) return "quality";
    const t = text.toLowerCase();
    for (const group of DV_KEYWORDS) { for (const kw of group) { if (t.includes(kw)) return DV_KEY_TO_IND[group[0]] || "quality"; } }
    return "quality";
  }
  function indicatorValue(result, key) { return key === "quality" ? result.composite.score : (result.indicators[key] ? result.indicators[key].score : 0); }
  function indicatorLabelForKey(key) { return key === "quality" ? "Public Space Quality Score" : CalcEngine.indicatorLabel(key); }

  function nextExperimentId() {
    const n = App.state.experiments.length + 1;
    return "EXP-" + String(n).padStart(3, "0");
  }

  function createOrUpdate(fields) {
    let exp = App.state.experiments.find(e => e.id === fields.id);
    if (!exp) {
      exp = { id: fields.id || nextExperimentId(), createdAt: Utils.nowISO(), results: null };
      App.state.experiments.push(exp);
    }
    Object.assign(exp, fields);
    App.state.activeExperimentId = exp.id;
    LogManager.add("Experiment created/updated", "experiment", "", exp.name || exp.id, exp.id);
    markDirty();
    return exp;
  }
  function getActive() { return App.state.experiments.find(e => e.id === App.state.activeExperimentId) || null; }
  function getById(id) { return App.state.experiments.find(e => e.id === id) || null; }
  function removeExperiment(id) {
    App.state.experiments = App.state.experiments.filter(e => e.id !== id);
    if (App.state.activeExperimentId === id) App.state.activeExperimentId = null;
    markDirty();
  }

  function setBaseline() {
    App.state.conditions.baseline = { id: Utils.uid("cond"), name: "Baseline", space: Utils.deepClone(App.state.space), timestamp: Utils.nowISO() };
    App.state.workflow.baseline = true;
    LogManager.add("Baseline set", "condition", "", "Baseline");
    markDirty();
  }
  function duplicateToTreatment() {
    if (!App.state.conditions.baseline) return false;
    App.state.conditions.treatment = { id: Utils.uid("cond"), name: "Treatment", space: Utils.deepClone(App.state.conditions.baseline.space), timestamp: Utils.nowISO() };
    App.state.workflow.treatment = true;
    LogManager.add("Treatment duplicated from baseline", "condition", "", "Treatment");
    markDirty();
    return true;
  }
  function lockControls(controlVarNames) {
    App.state.lockedControls = controlVarNames;
    App.state.workflow.locked = true;
    LogManager.add("Control variables locked", "lockedControls", "", controlVarNames.join("; "));
    markDirty();
  }

  function runControlled(measuredIndicatorKey) {
    const base = App.state.conditions.baseline, treat = App.state.conditions.treatment;
    if (!base || !treat) return null;
    const exp = getActive();
    const trials = exp ? Utils.clamp(exp.trials || 5, 1, 50) : 5;
    const stochastic = App.state.settings.stochasticEnabled;
    const variation = App.state.settings.stochasticLevel / 100;
    const seed = exp ? (exp.seed || 12345) : 12345;
    const rng = Utils.mulberry32(seed);

    function applyNoise(v) {
      if (!stochastic) return v;
      const delta = v * variation * (rng() * 2 - 1);
      return Utils.clamp(v + delta, 0, 100);
    }

    const baseIndicators = CalcEngine.computeIndicators(base.space, App.state.weights);
    const treatIndicators = CalcEngine.computeIndicators(treat.space, App.state.weights);
    const dvKey = measuredIndicatorKey || guessIndicatorFromText(exp ? exp.dv : App.state.study.dv);

    const baseVals = [], treatVals = [];
    for (let t = 1; t <= trials; t++) {
      const bv = applyNoise(indicatorValue(baseIndicators, dvKey));
      const tv = applyNoise(indicatorValue(treatIndicators, dvKey));
      baseVals.push(bv); treatVals.push(tv);
      DatasetManager.addRow({
        trial: t, condition: "Baseline", independent_variable: exp ? exp.iv : App.state.study.iv,
        independent_value: "baseline", dependent_variable: indicatorLabelForKey(dvKey), dependent_value: Utils.round1(bv),
        observation_type: "simulation"
      });
      DatasetManager.addRow({
        trial: t, condition: "Treatment", independent_variable: exp ? exp.iv : App.state.study.iv,
        independent_value: "treatment", dependent_variable: indicatorLabelForKey(dvKey), dependent_value: Utils.round1(tv),
        observation_type: "simulation"
      });
    }

    const result = {
      dvKey, dvLabel: indicatorLabelForKey(dvKey),
      baseline: { stats: StatsEngine.describe(baseVals), values: baseVals, indicators: baseIndicators },
      treatment: { stats: StatsEngine.describe(treatVals), values: treatVals, indicators: treatIndicators },
      meanDifference: StatsEngine.meanDifference(baseVals, treatVals),
      pctChange: StatsEngine.pctChange(baseVals, treatVals),
      smd: StatsEngine.standardizedMeanDifference(baseVals, treatVals),
      stochastic, trials
    };
    if (exp) { exp.results = result; }
    App.state.workflow.experimentRun = true;
    LogManager.add("Controlled experiment run", dvKey, Utils.round1(Utils.mean(baseVals)), Utils.round1(Utils.mean(treatVals)), exp ? exp.id : "");
    markDirty();
    return result;
  }

  function runParametric(varKey, levels) {
    const startSpace = App.state.conditions.baseline ? App.state.conditions.baseline.space : App.state.space;
    const rows = [];
    levels.forEach((lvl, i) => {
      const s = Utils.deepClone(startSpace);
      setVarValue(s, varKey, lvl);
      const result = CalcEngine.computeIndicators(s, App.state.weights);
      const row = {
        level: lvl, quality: Utils.round1(result.composite.score),
        comfort: Utils.round1(result.indicators.comfort.score), social: Utils.round1(result.indicators.social.score),
        accessibility: Utils.round1(result.indicators.accessibility.score)
      };
      rows.push(row);
      DatasetManager.addRow({
        trial: i + 1, condition: "Parametric:" + varLabel(varKey), independent_variable: varLabel(varKey), independent_value: lvl,
        dependent_variable: "Public Space Quality Score", dependent_value: row.quality, observation_type: "simulation"
      });
    });
    LogManager.add("Parametric study run", varKey, "", levels.join(","));
    App.state.workflow.experimentRun = true;
    markDirty();
    return rows;
  }

  function runSensitivity(varKey, indicatorKey) {
    const startSpace = App.state.conditions.baseline ? App.state.conditions.baseline.space : App.state.space;
    const baselineValue = getVarValue(startSpace, varKey);
    const pct = [-20, -10, 0, 10, 20];
    const rows = [];
    let baselineIndicator = null;
    pct.forEach(p => {
      const s = Utils.deepClone(startSpace);
      const newVal = Math.max(0, baselineValue * (1 + p / 100));
      setVarValue(s, varKey, newVal);
      const result = CalcEngine.computeIndicators(s, App.state.weights);
      const indVal = indicatorValue(result, indicatorKey);
      if (p === 0) baselineIndicator = indVal;
      rows.push({ pct, variableChangePct: p, variableValue: Utils.round1(newVal), indicatorValue: Utils.round1(indVal) });
    });
    rows.forEach(r => {
      const varDeltaPct = r.variableChangePct;
      const indDeltaPct = baselineIndicator ? ((r.indicatorValue - baselineIndicator) / baselineIndicator) * 100 : 0;
      r.indicatorChangePct = Utils.round1(indDeltaPct);
      r.sensitivity = varDeltaPct === 0 ? null : Utils.round1(indDeltaPct / varDeltaPct);
      DatasetManager.addRow({
        condition: "Sensitivity:" + varLabel(varKey), independent_variable: varLabel(varKey), independent_value: r.variableValue,
        dependent_variable: indicatorLabelForKey(indicatorKey), dependent_value: r.indicatorValue, observation_type: "simulation"
      });
    });
    LogManager.add("Sensitivity analysis run", varKey, "", indicatorKey);
    App.state.workflow.experimentRun = true;
    markDirty();
    return rows;
  }

  function addCondition(name) {
    if (App.state.conditions.list.length >= 10) { Utils.toast("Maximum of 10 conditions reached.", "error"); return null; }
    const letter = String.fromCharCode(65 + App.state.conditions.list.length);
    const cond = { id: Utils.uid("cond"), name: name || ("Condition " + letter), space: Utils.deepClone(App.state.space), notes: "", timestamp: Utils.nowISO() };
    App.state.conditions.list.push(cond);
    LogManager.add("Condition added", "conditions.list", "", cond.name);
    markDirty();
    return cond;
  }
  function removeCondition(id) { App.state.conditions.list = App.state.conditions.list.filter(c => c.id !== id); markDirty(); }

  function runReplicationTrials(trials, dvKey) {
    const conditionsToRun = [];
    if (App.state.conditions.baseline) conditionsToRun.push({ name: "Baseline", space: App.state.conditions.baseline.space });
    if (App.state.conditions.treatment) conditionsToRun.push({ name: "Treatment", space: App.state.conditions.treatment.space });
    if (!conditionsToRun.length) conditionsToRun.push({ name: "Current Space", space: App.state.space });

    const exp = getActive();
    const seed = exp ? (exp.seed || 12345) : 12345;
    const stochastic = App.state.settings.stochasticEnabled;
    const variation = App.state.settings.stochasticLevel / 100;
    const key = dvKey || guessIndicatorFromText(exp ? exp.dv : App.state.study.dv);
    const rows = [];
    conditionsToRun.forEach(cond => {
      const rng = Utils.mulberry32(seed + cond.name.length);
      const result = CalcEngine.computeIndicators(cond.space, App.state.weights);
      const baseVal = indicatorValue(result, key);
      for (let t = 1; t <= trials; t++) {
        const thisSeed = seed + t * 97 + cond.name.length;
        let v = baseVal;
        if (stochastic) { const delta = baseVal * variation * (rng() * 2 - 1); v = Utils.clamp(baseVal + delta, 0, 100); }
        rows.push({ trial: t, condition: cond.name, seed: thisSeed, value: Utils.round1(v), notes: stochastic ? "" : "Deterministic model — repeated trials identical unless stochastic variation enabled" });
        DatasetManager.addRow({
          trial: t, condition: cond.name, independent_variable: "trial", independent_value: t,
          dependent_variable: indicatorLabelForKey(key), dependent_value: Utils.round1(v), observation_type: "simulation"
        });
      }
    });
    LogManager.add("Replication trials run", key, "", trials + " trials");
    App.state.workflow.experimentRun = true;
    markDirty();
    return { rows, key, label: indicatorLabelForKey(key) };
  }

  return {
    VAR_CAT_MAP, VAR_PARAM_MAP, getVarValue, setVarValue, varLabel, guessIndicatorFromText, indicatorValue, indicatorLabelForKey,
    createOrUpdate, getActive, getById, removeExperiment, nextExperimentId,
    setBaseline, duplicateToTreatment, lockControls,
    runControlled, runParametric, runSensitivity, addCondition, removeCondition, runReplicationTrials
  };
})();

/* ===================== SPACE HISTORY (Undo/Redo) ===================== */
const SpaceHistory = (() => {
  let pending = null;
  const MAX = 50;
  function beginEdit() { if (pending === null) pending = Utils.deepClone(App.state.space); }
  function commitEdit() {
    if (pending === null) return;
    App.state.spaceHistory.stack.push(pending);
    if (App.state.spaceHistory.stack.length > MAX) App.state.spaceHistory.stack.shift();
    App.state.spaceHistory.redo = [];
    pending = null;
  }
  function cancelEdit() { pending = null; }
  function undo() {
    if (!App.state.spaceHistory.stack.length) { Utils.toast("Nothing to undo."); return false; }
    App.state.spaceHistory.redo.push(Utils.deepClone(App.state.space));
    App.state.space = App.state.spaceHistory.stack.pop();
    return true;
  }
  function redo() {
    if (!App.state.spaceHistory.redo.length) { Utils.toast("Nothing to redo."); return false; }
    App.state.spaceHistory.stack.push(Utils.deepClone(App.state.space));
    App.state.space = App.state.spaceHistory.redo.pop();
    return true;
  }
  return { beginEdit, commitEdit, cancelEdit, undo, redo };
})();

/* ===================== VIZ: SPACE CANVAS ===================== */
const Viz = (() => {
  const CAT_ADD_MAP = { entrance: "entrances", pathway: "pathways", seat: "seats", tree: "trees", shade: "shades", light: "lights", water: "water", edge: "edges", node: "nodes", obstacle: "obstacles" };
  const CAT_COLORS = { entrances: "#1c8a5a", pathways: "#8592a0", seats: "#1f6feb", trees: "#2f9e44", shades: "#b4750a", lights: "#d9a72c", water: "#1a8fd1", edges: "#6e4fc9", nodes: "#c0392b", obstacles: "#525f6b" };
  const HEAT_COLORS = { accessibility: "31,111,235", visibility: "110,79,201", activity: "180,117,10", social: "28,138,90", comfort: "192,57,43" };

  let dragState = null;

  function plazaRect(space) {
    const g = space.geometry;
    const availW = 880, availH = 880;
    let rectW, rectH;
    if (g.width >= g.length) {
      rectW = availW; rectH = availW * (g.length / g.width);
      if (rectH > availH) { rectH = availH; rectW = availH * (g.width / g.length); }
    } else {
      rectH = availH; rectW = availH * (g.width / g.length);
      if (rectW > availW) { rectW = availW; rectH = availW * (g.length / g.width); }
    }
    return { x: (1000 - rectW) / 2, y: (1000 - rectH) / 2, w: rectW, h: rectH };
  }
  function toXY(rect, fx, fy) { return { cx: rect.x + fx * rect.w, cy: rect.y + fy * rect.h }; }
  function projectToBoundary(x, y) {
    const dLeft = x, dRight = 1 - x, dTop = y, dBottom = 1 - y;
    const m = Math.min(dLeft, dRight, dTop, dBottom);
    const cy = Utils.clamp(y, 0, 1), cx = Utils.clamp(x, 0, 1);
    if (m === dLeft) return { x: 0, y: cy };
    if (m === dRight) return { x: 1, y: cy };
    if (m === dTop) return { x: cx, y: 0 };
    return { x: cx, y: 1 };
  }

  function group(cat, id, extraAttrs) {
    const g = Utils.svgEl("g", Object.assign({ "data-obj-id": id, "data-cat": cat, class: "canvas-object", tabindex: "0" }, extraAttrs || {}));
    return g;
  }

  function renderPlaza(svg, space) {
    const rect = plazaRect(space);
    const enclosureOpacity = 0.15 + (space.geometry.enclosure / 100) * 0.35;
    svg.appendChild(Utils.svgEl("rect", { x: rect.x, y: rect.y, width: rect.w, height: rect.h, fill: "#fbfcfd", stroke: "#334155", "stroke-width": 2, "stroke-opacity": enclosureOpacity, rx: 4 }));
    svg.appendChild(Utils.svgEl("rect", { x: rect.x, y: rect.y, width: rect.w, height: rect.h, fill: "none", stroke: "#c3ccd4", "stroke-width": 1.5, "stroke-dasharray": (space.geometry.openness > 60 ? "0" : "6,4"), rx: 4 }));
    return rect;
  }

  function renderObjects(svg, space, selection) {
    const rect = plazaRect(space);
    const o = space.objects;

    o.entrances.forEach(e => {
      const p = projectToBoundary(e.x, e.y); const pt = toXY(rect, p.x, p.y);
      const size = Utils.clamp((e.width || 3) * 3.2, 8, 40);
      const g = group("entrances", e.id);
      g.appendChild(Utils.svgEl("circle", { cx: pt.cx, cy: pt.cy, r: size / 2 + 4, fill: CAT_COLORS.entrances, "fill-opacity": 0.18 }));
      g.appendChild(Utils.svgEl("rect", { x: pt.cx - size / 2, y: pt.cy - 5, width: size, height: 10, fill: CAT_COLORS.entrances, rx: 2, class: selEq(selection, "entrances", e.id) ? "obj-selected" : "" }));
      g.appendChild(titleEl("Entrance · width " + (e.width || 3) + "m"));
      svg.appendChild(g);
    });

    o.pathways.forEach(pw => {
      const p1 = toXY(rect, pw.x1, pw.y1), p2 = toXY(rect, pw.x2, pw.y2);
      const g = group("pathways", pw.id);
      g.appendChild(Utils.svgEl("line", { x1: p1.cx, y1: p1.cy, x2: p2.cx, y2: p2.cy, stroke: CAT_COLORS.pathways, "stroke-width": Utils.clamp((pw.width || 2.5) * 3, 4, 20), "stroke-linecap": "round", class: selEq(selection, "pathways", pw.id) ? "obj-selected" : "" }));
      g.appendChild(Utils.svgEl("circle", { cx: p1.cx, cy: p1.cy, r: 7, fill: "#fff", stroke: CAT_COLORS.pathways, "stroke-width": 2, "data-handle": "1" }));
      g.appendChild(Utils.svgEl("circle", { cx: p2.cx, cy: p2.cy, r: 7, fill: "#fff", stroke: CAT_COLORS.pathways, "stroke-width": 2, "data-handle": "2" }));
      g.appendChild(titleEl("Pathway · width " + (pw.width || 2.5) + "m"));
      svg.appendChild(g);
    });

    o.trees.forEach(t => {
      const pt = toXY(rect, t.x, t.y);
      const r = Utils.clamp((t.canopy || 4) * 4, 8, 46);
      const g = group("trees", t.id);
      g.appendChild(Utils.svgEl("circle", { cx: pt.cx, cy: pt.cy, r, fill: CAT_COLORS.trees, "fill-opacity": 0.35, stroke: CAT_COLORS.trees, "stroke-width": 1.5, class: selEq(selection, "trees", t.id) ? "obj-selected" : "" }));
      g.appendChild(Utils.svgEl("circle", { cx: pt.cx, cy: pt.cy, r: 4, fill: "#1b5e20" }));
      g.appendChild(titleEl("Tree · canopy " + (t.canopy || 4) + "m"));
      svg.appendChild(g);
    });

    o.shades.forEach(s => {
      const pt = toXY(rect, s.x, s.y);
      const r = Utils.clamp((s.radius || 20) * 0.6, 10, 40);
      const g = group("shades", s.id);
      g.appendChild(Utils.svgEl("circle", { cx: pt.cx, cy: pt.cy, r, fill: "none", stroke: CAT_COLORS.shades, "stroke-width": 2.5, "stroke-dasharray": "5,3", class: selEq(selection, "shades", s.id) ? "obj-selected" : "" }));
      g.appendChild(titleEl("Shade (" + (s.type || "pergola") + ")"));
      svg.appendChild(g);
    });

    o.lights.forEach(l => {
      const pt = toXY(rect, l.x, l.y);
      const g = group("lights", l.id);
      g.appendChild(Utils.svgEl("circle", { cx: pt.cx, cy: pt.cy, r: 6, fill: CAT_COLORS.lights, class: selEq(selection, "lights", l.id) ? "obj-selected" : "" }));
      for (let a = 0; a < 6; a++) {
        const ang = a * Math.PI / 3;
        g.appendChild(Utils.svgEl("line", { x1: pt.cx + Math.cos(ang) * 8, y1: pt.cy + Math.sin(ang) * 8, x2: pt.cx + Math.cos(ang) * 14, y2: pt.cy + Math.sin(ang) * 14, stroke: CAT_COLORS.lights, "stroke-width": 1.5, opacity: 0.6 }));
      }
      g.appendChild(titleEl("Light · brightness " + (l.brightness || 60)));
      svg.appendChild(g);
    });

    o.water.forEach(w => {
      const pt = toXY(rect, w.x, w.y);
      const r = Utils.clamp((w.radius || 10) * 1.2, 8, 34);
      const g = group("water", w.id);
      g.appendChild(Utils.svgEl("circle", { cx: pt.cx, cy: pt.cy, r, fill: CAT_COLORS.water, "fill-opacity": 0.5, stroke: CAT_COLORS.water, "stroke-width": 1.5, class: selEq(selection, "water", w.id) ? "obj-selected" : "" }));
      g.appendChild(titleEl("Water feature"));
      svg.appendChild(g);
    });

    o.edges.forEach(e => {
      const p = projectToBoundary(e.x, e.y); const pt = toXY(rect, p.x, p.y);
      const len = Utils.clamp((e.length || 8) * 2.5, 14, 90);
      const horizontal = (p.y === 0 || p.y === 1);
      const color = e.type === "blank" ? "#8592a0" : CAT_COLORS.edges;
      const g = group("edges", e.id);
      const attrs = horizontal
        ? { x: pt.cx - len / 2, y: pt.cy - 4, width: len, height: 8 }
        : { x: pt.cx - 4, y: pt.cy - len / 2, width: 8, height: len };
      g.appendChild(Utils.svgEl("rect", Object.assign(attrs, { fill: color, opacity: 0.85, class: selEq(selection, "edges", e.id) ? "obj-selected" : "" })));
      g.appendChild(titleEl("Edge (" + e.type + ")"));
      svg.appendChild(g);
    });

    o.nodes.forEach(n => {
      const pt = toXY(rect, n.x, n.y);
      const g = group("nodes", n.id);
      g.appendChild(Utils.svgEl("rect", { x: pt.cx - 16, y: pt.cy - 16, width: 32, height: 32, rx: 8, fill: CAT_COLORS.nodes, "fill-opacity": 0.85, class: selEq(selection, "nodes", n.id) ? "obj-selected" : "" }));
      const label = Utils.svgEl("text", { x: pt.cx, y: pt.cy + 4, "text-anchor": "middle", "font-size": 10, fill: "#fff", "font-weight": "700" });
      label.textContent = (n.type || "node").slice(0, 2).toUpperCase();
      g.appendChild(label);
      g.appendChild(titleEl("Activity node (" + n.type + ")"));
      svg.appendChild(g);
    });

    o.seats.forEach(s => {
      const pt = toXY(rect, s.x, s.y);
      const g = group("seats", s.id);
      g.appendChild(Utils.svgEl("rect", { x: pt.cx - 9, y: pt.cy - 9, width: 18, height: 18, rx: 4, fill: CAT_COLORS.seats, class: selEq(selection, "seats", s.id) ? "obj-selected" : "" }));
      g.appendChild(titleEl("Seating (" + (s.type || "individual") + ")"));
      svg.appendChild(g);
    });

    o.obstacles.forEach(ob => {
      const pt = toXY(rect, ob.x, ob.y);
      const w = Utils.clamp((ob.width || 6) * 2.2, 10, 44), h = Utils.clamp((ob.height || 6) * 2.2, 10, 44);
      const g = group("obstacles", ob.id);
      g.appendChild(Utils.svgEl("rect", { x: pt.cx - w / 2, y: pt.cy - h / 2, width: w, height: h, fill: CAT_COLORS.obstacles, "fill-opacity": 0.8, class: selEq(selection, "obstacles", ob.id) ? "obj-selected" : "" }));
      g.appendChild(titleEl("Obstacle"));
      svg.appendChild(g);
    });
  }

  function titleEl(text) { const t = Utils.svgEl("title"); t.textContent = text; return t; }
  function selEq(selection, cat, id) { return selection && selection.cat === cat && selection.id === id; }

  function gaussianInfluence(fx, fy, points, sigma) {
    if (!points.length) return 0.12;
    let m = 0;
    points.forEach(p => { const d = Math.hypot(fx - p.x, fy - p.y); const v = Math.exp(-(d * d) / (2 * sigma * sigma)); if (v > m) m = v; });
    return m;
  }
  function heatValue(cat, fx, fy, space) {
    const o = space.objects;
    switch (cat) {
      case "accessibility": return gaussianInfluence(fx, fy, o.entrances.map(e => projectToBoundary(e.x, e.y)), 0.34);
      case "visibility": {
        const block = gaussianInfluence(fx, fy, o.obstacles.concat(o.trees).map(t => ({ x: t.x, y: t.y })), 0.13);
        return Utils.clamp(1 - block - (space.geometry.enclosure / 100) * 0.25, 0, 1);
      }
      case "activity": return gaussianInfluence(fx, fy, o.nodes.map(n => ({ x: n.x, y: n.y })), 0.22);
      case "social": return gaussianInfluence(fx, fy, o.seats.map(s => ({ x: s.x, y: s.y })).concat(o.nodes.map(n => ({ x: n.x, y: n.y }))), 0.2);
      case "comfort": return gaussianInfluence(fx, fy, o.shades.map(s => ({ x: s.x, y: s.y })).concat(o.trees.map(t => ({ x: t.x, y: t.y }))).concat(o.water.map(w => ({ x: w.x, y: w.y }))), 0.22);
      default: return 0;
    }
  }
  function renderHeatmap(svg, space, rect, cat, opacityPct) {
    if (!cat || cat === "none") return;
    const N = 22;
    const color = HEAT_COLORS[cat] || "31,111,235";
    const userOp = opacityPct / 100;
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const fx = (col + 0.5) / N, fy = (row + 0.5) / N;
        const v = heatValue(cat, fx, fy, space);
        if (v < 0.04) continue;
        const pt = toXY(rect, col / N, row / N);
        svg.appendChild(Utils.svgEl("rect", {
          x: pt.cx, y: pt.cy, width: rect.w / N + 0.5, height: rect.h / N + 0.5,
          fill: "rgb(" + color + ")", opacity: Utils.round1(v * userOp)
        }));
      }
    }
  }

  function render() {
    const svg = document.getElementById("spaceCanvas");
    if (!svg) return;
    svg.innerHTML = "";
    const space = App.state.space;
    const rect = renderPlaza(svg, space);
    const heatCat = document.getElementById("heatmapSelect") ? document.getElementById("heatmapSelect").value : "none";
    const heatOp = document.getElementById("heatmapOpacity") ? Number(document.getElementById("heatmapOpacity").value) : 55;
    renderHeatmap(svg, space, rect, heatCat, heatOp);
    renderObjects(svg, space, App.state.selection);
  }

  function svgPointFromEvent(e) {
    const svg = document.getElementById("spaceCanvas");
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0.5, y: 0.5 };
    const loc = pt.matrixTransform(ctm.inverse());
    const rect = plazaRect(App.state.space);
    return { x: (loc.x - rect.x) / rect.w, y: (loc.y - rect.y) / rect.h };
  }

  function onPointerDown(e) {
    const targetGroup = e.target.closest("[data-obj-id]");
    if (!targetGroup) { selectObject(null); return; }
    const cat = targetGroup.dataset.cat, id = targetGroup.dataset.objId;
    const handleAttr = e.target.getAttribute && e.target.getAttribute("data-handle");
    dragState = { cat, id, handle: handleAttr || null, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId, target: targetGroup };
    try { targetGroup.setPointerCapture(e.pointerId); } catch (err) {}
    SpaceHistory.beginEdit();
    targetGroup.addEventListener("pointermove", onPointerMove);
    targetGroup.addEventListener("pointerup", onPointerUp);
    targetGroup.addEventListener("pointercancel", onPointerUp);
  }
  function onPointerMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
    if (Math.hypot(dx, dy) > 3) dragState.moved = true;
    if (!dragState.moved) return;
    const frac = svgPointFromEvent(e);
    const list = App.state.space.objects[dragState.cat];
    const obj = list.find(o => o.id === dragState.id);
    if (!obj) return;
    if (dragState.cat === "pathways") {
      if (dragState.handle === "2") { obj.x2 = SpaceModel.clamp01(frac.x); obj.y2 = SpaceModel.clamp01(frac.y); }
      else { obj.x1 = SpaceModel.clamp01(frac.x); obj.y1 = SpaceModel.clamp01(frac.y); }
    } else {
      obj.x = SpaceModel.clamp01(frac.x); obj.y = SpaceModel.clamp01(frac.y);
    }
    render();
  }
  function onPointerUp(e) {
    if (!dragState) return;
    const target = dragState.target;
    target.removeEventListener("pointermove", onPointerMove);
    target.removeEventListener("pointerup", onPointerUp);
    target.removeEventListener("pointercancel", onPointerUp);
    if (dragState.moved) {
      SpaceHistory.commitEdit();
      App.onSpaceChanged();
    } else {
      SpaceHistory.cancelEdit();
      selectObject({ cat: dragState.cat, id: dragState.id });
    }
    dragState = null;
  }

  function selectObject(sel) {
    App.state.selection = sel;
    render();
    if (App.renderPropertiesPanel) App.renderPropertiesPanel();
  }

  function addObjectFromTool(toolKey) {
    const cat = CAT_ADD_MAP[toolKey];
    if (!cat) return;
    SpaceHistory.beginEdit();
    const obj = SpaceModel.addObject(App.state.space, cat);
    SpaceHistory.commitEdit();
    LogManager.add("Object added", cat, "", obj.id);
    selectObject({ cat, id: obj.id });
    App.onSpaceChanged();
  }

  function deleteSelected() {
    const sel = App.state.selection;
    if (!sel) return;
    SpaceHistory.beginEdit();
    App.state.space.objects[sel.cat] = App.state.space.objects[sel.cat].filter(o => o.id !== sel.id);
    SpaceHistory.commitEdit();
    LogManager.add("Object deleted", sel.cat, sel.id, "");
    App.state.selection = null;
    App.onSpaceChanged();
    if (App.renderPropertiesPanel) App.renderPropertiesPanel();
  }

  function init() {
    const svg = document.getElementById("spaceCanvas");
    svg.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && App.state.selection) {
        const tag = document.activeElement ? document.activeElement.tagName : "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        deleteSelected();
      }
    });
  }

  function randomize(seed) {
    SpaceHistory.beginEdit();
    const rng = Utils.mulberry32(seed || Date.now());
    const space = App.state.space;
    SpaceModel.OBJ_CATS.forEach(cat => {
      const n = space.objects[cat].length || Math.floor(rng() * 6) + 1;
      space.objects[cat] = [];
      SpaceModel.setObjectCount(space, cat, n);
      space.objects[cat].forEach(o => {
        if (cat === "pathways") { o.x1 = rng(); o.y1 = rng(); o.x2 = rng(); o.y2 = rng(); }
        else { o.x = rng(); o.y = rng(); }
      });
    });
    SpaceHistory.commitEdit();
    LogManager.add("Space randomized", "objects", "", "seed:" + (seed || "auto"));
    App.onSpaceChanged();
  }

  function clearSpace() {
    SpaceHistory.beginEdit();
    App.state.space.objects = SpaceModel.emptyObjects();
    App.state.selection = null;
    SpaceHistory.commitEdit();
    LogManager.add("Space cleared", "objects", "", "");
    App.onSpaceChanged();
  }

  return { plazaRect, projectToBoundary, render, init, addObjectFromTool, deleteSelected, selectObject, randomize, clearSpace, CAT_ADD_MAP };
})();

/* ===================== CHARTS (pure SVG, no libraries) ===================== */
const Charts = (() => {
  const PALETTE = ["#1f6feb", "#1c8a5a", "#b4750a", "#6e4fc9", "#c0392b", "#0e8a8a"];

  function clear(svg) { svg.innerHTML = ""; }
  function textEl(x, y, text, attrs) {
    const t = Utils.svgEl("text", Object.assign({ x, y, "font-size": 10, fill: "#525f6b" }, attrs || {}));
    t.textContent = text;
    return t;
  }

  function barChart(svg, labels, values, opts) {
    clear(svg);
    opts = opts || {};
    const W = 700, H = 320, ml = 46, mr = 16, mt = 16, mb = 56;
    const plotW = W - ml - mr, plotH = H - mt - mb;
    const maxV = opts.max || Math.max(10, ...values, 100 * 0);
    const yMax = opts.fixedMax !== undefined ? opts.fixedMax : Math.max(...values, 1) * 1.15;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.appendChild(Utils.svgEl("line", { x1: ml, y1: mt, x2: ml, y2: mt + plotH, stroke: "#c3ccd4" }));
    svg.appendChild(Utils.svgEl("line", { x1: ml, y1: mt + plotH, x2: ml + plotW, y2: mt + plotH, stroke: "#c3ccd4" }));
    for (let i = 0; i <= 4; i++) {
      const y = mt + plotH - (i / 4) * plotH;
      svg.appendChild(Utils.svgEl("line", { x1: ml, y1: y, x2: ml + plotW, y2: y, stroke: "#eef1f4" }));
      svg.appendChild(textEl(ml - 8, y + 3, Utils.round1((i / 4) * yMax), { "text-anchor": "end" }));
    }
    const bw = plotW / values.length;
    values.forEach((v, i) => {
      const h = (v / yMax) * plotH;
      const x = ml + i * bw + bw * 0.15;
      const barW = bw * 0.7;
      svg.appendChild(Utils.svgEl("rect", { x, y: mt + plotH - h, width: barW, height: h, fill: PALETTE[i % PALETTE.length], rx: 2 }));
      svg.appendChild(textEl(x + barW / 2, mt + plotH - h - 5, Utils.round1(v), { "text-anchor": "middle", "font-size": 10, fill: "#161c22" }));
      const lbl = textEl(x + barW / 2, mt + plotH + 16, String(labels[i]), { "text-anchor": "middle" });
      lbl.setAttribute("transform", "rotate(0)");
      svg.appendChild(lbl);
    });
  }

  function lineChart(svg, xLabels, series, opts) {
    // series: [{name, values, color}]
    clear(svg);
    opts = opts || {};
    const W = 600, H = 300, ml = 46, mr = 16, mt = 16, mb = 40;
    const plotW = W - ml - mr, plotH = H - mt - mb;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    const allVals = series.flatMap(s => s.values);
    const yMin = opts.yMin !== undefined ? opts.yMin : Math.min(0, ...allVals);
    const yMax = opts.yMax !== undefined ? opts.yMax : Math.max(...allVals, 1) * 1.1;
    svg.appendChild(Utils.svgEl("line", { x1: ml, y1: mt, x2: ml, y2: mt + plotH, stroke: "#c3ccd4" }));
    svg.appendChild(Utils.svgEl("line", { x1: ml, y1: mt + plotH, x2: ml + plotW, y2: mt + plotH, stroke: "#c3ccd4" }));
    for (let i = 0; i <= 4; i++) {
      const yv = yMin + (i / 4) * (yMax - yMin);
      const y = mt + plotH - (i / 4) * plotH;
      svg.appendChild(Utils.svgEl("line", { x1: ml, y1: y, x2: ml + plotW, y2: y, stroke: "#eef1f4" }));
      svg.appendChild(textEl(ml - 8, y + 3, Utils.round1(yv), { "text-anchor": "end" }));
    }
    const n = xLabels.length;
    xLabels.forEach((l, i) => {
      const x = ml + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
      svg.appendChild(textEl(x, mt + plotH + 16, String(l), { "text-anchor": "middle" }));
    });
    series.forEach((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      let d = "";
      s.values.forEach((v, i) => {
        const x = ml + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
        const y = mt + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
        d += (i === 0 ? "M" : "L") + x + "," + y + " ";
        svg.appendChild(Utils.svgEl("circle", { cx: x, cy: y, r: 3.5, fill: color }));
      });
      svg.appendChild(Utils.svgEl("path", { d, fill: "none", stroke: color, "stroke-width": 2 }));
    });
    if (series.length > 1) {
      series.forEach((s, si) => {
        const color = s.color || PALETTE[si % PALETTE.length];
        svg.appendChild(Utils.svgEl("rect", { x: ml + si * 90, y: 4, width: 8, height: 8, fill: color }));
        svg.appendChild(textEl(ml + si * 90 + 12, 12, s.name, { "font-size": 10 }));
      });
    }
  }

  function scatterChart(svg, points, opts) {
    clear(svg); opts = opts || {};
    const W = 500, H = 400, ml = 48, mr = 20, mt = 20, mb = 46;
    const plotW = W - ml - mr, plotH = H - mt - mb;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    if (!points.length) { svg.appendChild(textEl(W / 2, H / 2, "No data available", { "text-anchor": "middle" })); return; }
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xr = (xMax - xMin) || 1, yr = (yMax - yMin) || 1;
    svg.appendChild(Utils.svgEl("line", { x1: ml, y1: mt, x2: ml, y2: mt + plotH, stroke: "#c3ccd4" }));
    svg.appendChild(Utils.svgEl("line", { x1: ml, y1: mt + plotH, x2: ml + plotW, y2: mt + plotH, stroke: "#c3ccd4" }));
    svg.appendChild(textEl(ml, mt + plotH + 30, opts.xLabel || "X", { "font-size": 11 }));
    svg.appendChild(textEl(10, mt + 10, opts.yLabel || "Y", { "font-size": 11 }));
    function px(v) { return ml + ((v - xMin) / xr) * plotW; }
    function py(v) { return mt + plotH - ((v - yMin) / yr) * plotH; }
    points.forEach(p => {
      const c = Utils.svgEl("circle", { cx: px(p.x), cy: py(p.y), r: 5, fill: "#1f6feb", "fill-opacity": 0.75, stroke: "#1657c0" });
      const tt = Utils.svgEl("title"); tt.textContent = (p.label || "") + " (" + Utils.round1(p.x) + ", " + Utils.round1(p.y) + ")";
      c.appendChild(tt);
      svg.appendChild(c);
    });
    if (points.length > 1) {
      const n = points.length, mx = Utils.mean(xs), my = Utils.mean(ys);
      let num = 0, den = 0;
      points.forEach(p => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) * (p.x - mx); });
      if (den !== 0) {
        const slope = num / den, intercept = my - slope * mx;
        const x1 = xMin, x2 = xMax;
        svg.appendChild(Utils.svgEl("line", { x1: px(x1), y1: py(slope * x1 + intercept), x2: px(x2), y2: py(slope * x2 + intercept), stroke: "#c0392b", "stroke-width": 1.5, "stroke-dasharray": "5,3" }));
      }
    }
  }

  function radarChart(svg, labels, values, opts) {
    clear(svg); opts = opts || {};
    const W = 400, H = 400, cx = W / 2, cy = H / 2, R = 150;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    const n = labels.length;
    for (let ring = 1; ring <= 4; ring++) {
      let d = "";
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const r = R * (ring / 4);
        d += (i === 0 ? "M" : "L") + (cx + r * Math.cos(ang)) + "," + (cy + r * Math.sin(ang)) + " ";
      }
      svg.appendChild(Utils.svgEl("path", { d: d + "Z", fill: "none", stroke: "#eef1f4" }));
    }
    let axisD = "";
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const x2 = cx + R * Math.cos(ang), y2 = cy + R * Math.sin(ang);
      svg.appendChild(Utils.svgEl("line", { x1: cx, y1: cy, x2, y2, stroke: "#dde3e9" }));
      const lx = cx + (R + 26) * Math.cos(ang), ly = cy + (R + 26) * Math.sin(ang);
      svg.appendChild(textEl(lx, ly, labels[i], { "text-anchor": "middle", "font-size": 9 }));
    }
    let d = "";
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const r = R * (Utils.clamp(values[i], 0, 100) / 100);
      d += (i === 0 ? "M" : "L") + (cx + r * Math.cos(ang)) + "," + (cy + r * Math.sin(ang)) + " ";
    }
    svg.appendChild(Utils.svgEl("path", { d: d + "Z", fill: "#1f6feb", "fill-opacity": 0.25, stroke: "#1f6feb", "stroke-width": 2 }));
  }

  function histogram(svg, values, bins, opts) {
    clear(svg); opts = opts || {};
    const W = 700, H = 320, ml = 46, mr = 16, mt = 16, mb = 40;
    const plotW = W - ml - mr, plotH = H - mt - mb;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    if (!values.length) { svg.appendChild(textEl(W / 2, H / 2, "No data available", { "text-anchor": "middle" })); return; }
    const min = Math.min(...values), max = Math.max(...values);
    const range = (max - min) || 1;
    const nBins = bins || 8;
    const counts = new Array(nBins).fill(0);
    values.forEach(v => { let idx = Math.floor(((v - min) / range) * nBins); if (idx >= nBins) idx = nBins - 1; if (idx < 0) idx = 0; counts[idx]++; });
    const maxCount = Math.max(...counts, 1);
    svg.appendChild(Utils.svgEl("line", { x1: ml, y1: mt, x2: ml, y2: mt + plotH, stroke: "#c3ccd4" }));
    svg.appendChild(Utils.svgEl("line", { x1: ml, y1: mt + plotH, x2: ml + plotW, y2: mt + plotH, stroke: "#c3ccd4" }));
    const bw = plotW / nBins;
    counts.forEach((c, i) => {
      const h = (c / maxCount) * plotH;
      svg.appendChild(Utils.svgEl("rect", { x: ml + i * bw + 2, y: mt + plotH - h, width: bw - 4, height: h, fill: "#1f6feb", rx: 2 }));
      svg.appendChild(textEl(ml + i * bw + bw / 2, mt + plotH - h - 5, c, { "text-anchor": "middle" }));
      const lo = min + (i / nBins) * range;
      svg.appendChild(textEl(ml + i * bw + bw / 2, mt + plotH + 14, Utils.round1(lo), { "text-anchor": "middle", "font-size": 8.5 }));
    });
  }

  function boxStyle(svg, values, opts) {
    clear(svg); opts = opts || {};
    const W = 700, H = 320, ml = 60, mr = 60, mt = 30, mb = 40;
    const plotW = W - ml - mr, plotH = H - mt - mb;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    if (!values.length) { svg.appendChild(textEl(W / 2, H / 2, "No data available", { "text-anchor": "middle" })); return; }
    const q = Utils.quartiles(values);
    const yMin = Math.min(q.min, 0), yMax = Math.max(q.max, 1) * 1.05;
    function py(v) { return mt + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH; }
    svg.appendChild(Utils.svgEl("line", { x1: ml, y1: mt, x2: ml, y2: mt + plotH, stroke: "#c3ccd4" }));
    for (let i = 0; i <= 4; i++) {
      const yv = yMin + (i / 4) * (yMax - yMin);
      svg.appendChild(textEl(ml - 8, py(yv) + 3, Utils.round1(yv), { "text-anchor": "end" }));
      svg.appendChild(Utils.svgEl("line", { x1: ml, y1: py(yv), x2: ml + plotW, y2: py(yv), stroke: "#eef1f4" }));
    }
    const cx = ml + plotW / 2, boxW = 120;
    svg.appendChild(Utils.svgEl("line", { x1: cx, y1: py(q.min), x2: cx, y2: py(q.max), stroke: "#525f6b" }));
    svg.appendChild(Utils.svgEl("line", { x1: cx - 20, y1: py(q.min), x2: cx + 20, y2: py(q.min), stroke: "#525f6b" }));
    svg.appendChild(Utils.svgEl("line", { x1: cx - 20, y1: py(q.max), x2: cx + 20, y2: py(q.max), stroke: "#525f6b" }));
    svg.appendChild(Utils.svgEl("rect", { x: cx - boxW / 2, y: py(q.q3), width: boxW, height: Math.max(1, py(q.q1) - py(q.q3)), fill: "#1f6feb", "fill-opacity": 0.25, stroke: "#1f6feb", "stroke-width": 2 }));
    svg.appendChild(Utils.svgEl("line", { x1: cx - boxW / 2, y1: py(q.q2), x2: cx + boxW / 2, y2: py(q.q2), stroke: "#1657c0", "stroke-width": 2.5 }));
    ["min", "q1", "q2", "q3", "max"].forEach(k => {
      svg.appendChild(textEl(cx + boxW / 2 + 10, py(q[k]) + 3, k.toUpperCase() + ": " + Utils.round1(q[k]), { "font-size": 9.5 }));
    });
  }

  return { barChart, lineChart, scatterChart, radarChart, histogram, boxStyle, clear };
})();

/* ===================== RESEARCH QUALITY CHECK ===================== */
const QualityCheck = (() => {
  function items() {
    const s = App.state;
    const exp = ExperimentEngine.getActive();
    return [
      { label: "Research question defined", ok: !!s.study.question.trim() },
      { label: "Hypothesis defined", ok: !!s.study.hypothesis.trim() },
      { label: "Independent variable defined", ok: !!s.study.iv.trim() },
      { label: "Dependent variable defined", ok: !!s.study.dv.trim() },
      { label: "Control variables defined", ok: !!s.study.controls.trim() },
      { label: "Baseline created", ok: !!s.conditions.baseline },
      { label: "Treatment created", ok: !!s.conditions.treatment },
      { label: "Control variables locked", ok: s.lockedControls.length > 0 },
      { label: "Replication defined", ok: !!(exp && exp.replication >= 1) },
      { label: "Dataset contains observations", ok: s.dataset.length > 0 },
      { label: "Statistical analysis available", ok: s.dataset.filter(r => !isNaN(Number(r.dependent_value))).length >= 2 },
      { label: "Limitations acknowledged", ok: true },
      { label: "Model assumptions documented", ok: true }
    ];
  }
  function completeness() {
    const it = items();
    const ok = it.filter(i => i.ok).length;
    return Math.round((ok / it.length) * 100);
  }
  return { items, completeness };
})();

/* ===================== REPORT GENERATOR ===================== */
const ReportGenerator = (() => {
  function cautious(text) { return text; }

  function buildSummary() {
    const s = App.state.study;
    const exp = ExperimentEngine.getActive();
    const lines = [];
    lines.push("PUBLIC SPACE RESEARCH LABORATORY — RESEARCH SUMMARY");
    lines.push("Generated: " + Utils.fmtTime(Utils.nowISO()));
    lines.push("Study ID: " + App.state.studyId);
    lines.push("");
    lines.push("TITLE: " + (s.title || "(untitled study)"));
    lines.push("");
    lines.push("RESEARCH QUESTION");
    lines.push(s.question || "(not defined)");
    lines.push("");
    lines.push("RESEARCH OBJECTIVE");
    lines.push(s.objective || "(not defined)");
    lines.push("");
    lines.push("HYPOTHESIS");
    lines.push(s.hypothesis || "(not defined)");
    lines.push("");
    lines.push("VARIABLES");
    lines.push("Independent Variable: " + (s.iv || "(not defined)"));
    lines.push("Dependent Variable: " + (s.dv || "(not defined)"));
    lines.push("Control Variables: " + (s.controls || "(not defined)"));
    lines.push("Research Type: " + s.type);
    lines.push("");
    lines.push("EXPERIMENTAL DESIGN");
    if (exp) {
      lines.push("Experiment: " + exp.id + " — " + (exp.name || ""));
      lines.push("Trials: " + exp.trials + " | Replication: " + exp.replication + " | Seed: " + exp.seed);
    } else {
      lines.push("(no experiment configured yet)");
    }
    lines.push("Control Condition: " + (App.state.conditions.baseline ? App.state.conditions.baseline.name : "(not set)"));
    lines.push("Treatment Condition: " + (App.state.conditions.treatment ? App.state.conditions.treatment.name : "(not set)"));
    lines.push("Control Variables Locked: " + (App.state.lockedControls.length ? App.state.lockedControls.join(", ") : "(none locked)"));
    lines.push("");
    lines.push("MEASUREMENTS");
    lines.push("Dataset rows collected: " + App.state.dataset.length);
    const simN = App.state.dataset.filter(r => r.observation_type === "simulation").length;
    const obsN = App.state.dataset.filter(r => r.observation_type === "observation").length;
    const parN = App.state.dataset.filter(r => r.observation_type === "participant").length;
    lines.push("  Simulation rows (model-based indicators): " + simN);
    lines.push("  Researcher-entered observation rows: " + obsN);
    lines.push("  Participant-reported response rows: " + parN);
    lines.push("");
    lines.push("RESULTS");
    if (exp && exp.results) {
      const r = exp.results;
      lines.push("Measured indicator: " + r.dvLabel + " (model-based composite indicator)");
      lines.push("Baseline — mean: " + r.baseline.stats.mean + ", sd: " + r.baseline.stats.sd + ", n: " + r.baseline.stats.n);
      lines.push("Treatment — mean: " + r.treatment.stats.mean + ", sd: " + r.treatment.stats.sd + ", n: " + r.treatment.stats.n);
      lines.push("Mean difference (treatment − baseline): " + r.meanDifference);
      lines.push("Percentage change: " + (r.pctChange === null ? "n/a" : r.pctChange + "%"));
      lines.push("Standardized mean difference (effect size): " + (r.smd === null ? "n/a (insufficient variance/replication)" : r.smd));
      lines.push("Stochastic model variation: " + (r.stochastic ? "enabled (" + App.state.settings.stochasticLevel + "%)" : "disabled (deterministic model)"));
      lines.push("");
      lines.push(cautious("The simulation indicates that the treatment condition was associated with a " + (r.meanDifference >= 0 ? "higher" : "lower") + " model-based " + r.dvLabel.toLowerCase() + " compared to the baseline condition, under the specified assumptions and weighting."));
    } else {
      lines.push("(no controlled experiment has been run yet)");
    }
    lines.push("");
    lines.push("DESCRIPTIVE STATISTICS (all simulation dataset rows)");
    const allVals = DatasetManager.numericValues("simulation");
    const desc = StatsEngine.describe(allVals);
    lines.push("n=" + desc.n + ", mean=" + desc.mean + ", median=" + desc.median + ", sd=" + desc.sd + ", min=" + desc.min + ", max=" + desc.max + ", range=" + desc.range);
    lines.push("");
    lines.push("LIMITATIONS");
    MODEL_LIMITATIONS.forEach(l => lines.push("- " + l));
    lines.push("");
    lines.push("INTERPRETATION");
    lines.push(cautious("Results should be interpreted as computational, model-based estimates that depend on the assumptions and weights specified within this instrument. They are not validated empirical measurements of real-world human behavior."));
    lines.push("");
    lines.push("SUGGESTED DISCUSSION POINTS");
    lines.push("- How do the component variables driving the observed difference relate to established literature?");
    lines.push("- What empirical data-collection methods (observation, survey, sensor) could validate these model-based indicators?");
    lines.push("- Which model assumptions or weights most influenced the result, and how sensitive is the conclusion to them?");
    lines.push("");
    lines.push("DATA AVAILABILITY STATEMENT");
    lines.push("The full dataset (" + App.state.dataset.length + " rows) generated by this instrument can be exported as CSV/JSON from the Dataset module.");
    lines.push("");
    lines.push("REPRODUCIBILITY INFORMATION");
    lines.push("Model version: " + MODEL_VERSION + " | Study ID: " + App.state.studyId + " | Experiment ID: " + (exp ? exp.id : "n/a"));
    return lines.join("\n");
  }

  function buildPaper() {
    const s = App.state.study;
    const exp = ExperimentEngine.getActive();
    const desc = StatsEngine.describe(DatasetManager.numericValues("simulation"));
    const L = [];
    L.push("RESEARCH PAPER BUILDER — STRUCTURED DRAFT");
    L.push("(Generates a structured research draft requiring researcher verification, empirical validation, and appropriate citation. This is not an automatically publishable paper.)");
    L.push("");
    L.push("1. INTRODUCTION");
    L.push((s.context || "This study investigates public-space design characteristics using a virtual, computational research instrument.") + " " + (s.objective || ""));
    L.push("");
    L.push("2. RESEARCH QUESTION");
    L.push(s.question || "(not defined)");
    L.push("");
    L.push("3. HYPOTHESIS");
    L.push(s.hypothesis || "(not defined)");
    L.push("");
    L.push("4. METHODOLOGY");
    L.push("This study used the Public Space Research Laboratory, a browser-based virtual experimental research instrument, to construct a parametrized public-space configuration and compute transparent, model-based indicators of accessibility, walkability, visibility, safety potential, social interaction potential, environmental comfort, privacy, sociability, thermal comfort potential, and activity diversity. Research type: " + s.type + ".");
    L.push("");
    L.push("5. EXPERIMENTAL SETUP");
    L.push("Baseline condition: " + (App.state.conditions.baseline ? App.state.conditions.baseline.name : "(not set)"));
    L.push("Treatment condition: " + (App.state.conditions.treatment ? App.state.conditions.treatment.name : "(not set)"));
    L.push("Locked control variables: " + (App.state.lockedControls.length ? App.state.lockedControls.join(", ") : "(none)"));
    L.push("Trials: " + (exp ? exp.trials : "n/a") + " | Replication: " + (exp ? exp.replication : "n/a") + " | Randomization seed: " + (exp ? exp.seed : "n/a"));
    L.push("");
    L.push("6. VARIABLES");
    L.push("Independent variable: " + (s.iv || exp && exp.iv || "(not defined)"));
    L.push("Dependent variable: " + (s.dv || exp && exp.dv || "(not defined)"));
    L.push("Control variables: " + (s.controls || "(not defined)"));
    L.push("");
    L.push("7. RESULTS");
    if (exp && exp.results) {
      const r = exp.results;
      L.push("Measured model-based indicator: " + r.dvLabel);
      L.push("Baseline mean = " + r.baseline.stats.mean + " (SD = " + r.baseline.stats.sd + ", n = " + r.baseline.stats.n + ")");
      L.push("Treatment mean = " + r.treatment.stats.mean + " (SD = " + r.treatment.stats.sd + ", n = " + r.treatment.stats.n + ")");
      L.push("Mean difference = " + r.meanDifference + "; percentage change = " + (r.pctChange === null ? "n/a" : r.pctChange + "%") + "; standardized mean difference = " + (r.smd === null ? "n/a" : r.smd));
    } else {
      L.push("(no controlled experiment results available — run one from the Experiment module)");
    }
    L.push("");
    L.push("8. STATISTICAL ANALYSIS");
    L.push("Across all simulation dataset rows: n=" + desc.n + ", mean=" + desc.mean + ", median=" + desc.median + ", SD=" + desc.sd + ", range=" + desc.range + ".");
    L.push("Effect sizes reported (mean difference, percentage difference, standardized mean difference) are calculated from the collected/model data and should not be interpreted as externally validated evidence without empirical validation.");
    L.push("");
    L.push("9. DISCUSSION");
    L.push(cautious("Within the assumptions of this computational model, the observed pattern is consistent with the stated hypothesis to the extent described above. This association should not be read as a causal or generalizable claim about real-world human behavior without independent empirical validation (field observation, participant studies, or sensor data)."));
    L.push("");
    L.push("10. LIMITATIONS");
    MODEL_LIMITATIONS.forEach(l => L.push("- " + l));
    L.push("");
    L.push("11. CONCLUSION");
    L.push(cautious("This computational experiment provides a preliminary, model-based exploration of the stated research question. Empirical validation is required before drawing substantive conclusions about real-world public-space performance."));
    L.push("");
    L.push("12. REPRODUCIBILITY");
    const rp = reproManifest();
    L.push("Study ID: " + rp.studyId + " | Experiment ID: " + rp.experimentId + " | Model version: " + rp.modelVersion);
    L.push("Configuration hash: " + rp.configHash + " | Dataset size: " + rp.datasetSize + " rows");
    return L.join("\n");
  }

  function reproManifest() {
    const exp = ExperimentEngine.getActive();
    const configString = JSON.stringify({ space: App.state.space, weights: App.state.weights, conditions: App.state.conditions });
    return {
      studyId: App.state.studyId,
      experimentId: exp ? exp.id : "n/a",
      date: Utils.nowISO(),
      modelVersion: MODEL_VERSION,
      assumptions: [
        "Spatial simulation units are canvas-relative fractions, not GPS/survey coordinates.",
        "Abstract parameters (path directness, noise, crowding, hardscape, etc.) are researcher-set scenario assumptions.",
        "Composite indicators use linear weighted-sum formulas with researcher-adjustable weights.",
        "Stochastic variation (if enabled) is a synthetic noise term, not measured behavioral variability."
      ],
      trials: exp ? exp.trials : null,
      replication: exp ? exp.replication : null,
      seed: exp ? exp.seed : null,
      stochastic: App.state.settings.stochasticEnabled,
      stochasticLevel: App.state.settings.stochasticLevel,
      datasetSize: App.state.dataset.length,
      configHash: Utils.hashString(configString)
    };
  }

  return { buildSummary, buildPaper, reproManifest };
})();

const MODEL_LIMITATIONS = [
  "This laboratory is a computational research prototype.",
  "Model-based indicators are not substitutes for field measurements.",
  "Simulated behavior is not equivalent to observed human behavior.",
  "Results depend on model assumptions and weighting.",
  "Empirical validation is required before treating indicators as validated measurements.",
  "Correlation does not establish causation.",
  "Composite scores should be interpreted in relation to their component variables."
];

/* ===================== UI: CORE (tabs, status, modals, workflow) ===================== */
const UI = {};

UI.switchTab = function (tabKey) {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.tab === tabKey));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + tabKey));
  const sidebar = document.getElementById("sidebar");
  if (sidebar && sidebar.classList.contains("open")) sidebar.classList.remove("open");
  if (tabKey === "space-builder") Viz.render();
  if (tabKey === "variables") UI.renderVariablesPanel();
  if (tabKey === "dataset") UI.renderDatasetPanel();
  if (tabKey === "analysis") UI.renderAnalysisPanel();
  if (tabKey === "report") UI.renderReportStatics();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
};

UI.switchSubTab = function (groupSelector, btnAttr, panelSelector, panelAttr, key) {
  document.querySelectorAll(groupSelector + " [" + btnAttr + "]").forEach(b => b.classList.toggle("active", b.getAttribute(btnAttr) === key));
  document.querySelectorAll("[" + panelAttr + "]").forEach(p => p.classList.toggle("active", p.getAttribute(panelAttr) === key));
};

UI.setStatus = function (status) {
  const dot = document.getElementById("statusDot"), text = document.getElementById("statusText");
  dot.className = "status-dot " + (status === "running" ? "status-running" : status === "collected" ? "status-collected" : "status-ready");
  text.textContent = status === "running" ? "EXPERIMENT RUNNING" : status === "collected" ? "DATA COLLECTED" : "READY";
};

UI.updateWorkflowBar = function () {
  const w = App.state.workflow;
  const stepDone = {
    1: !!App.state.study.question.trim(), 2: true, 3: !!App.state.conditions.baseline,
    4: !!App.state.conditions.treatment, 5: App.state.lockedControls.length > 0, 6: w.experimentRun,
    7: w.observations, 8: w.analyzed, 9: w.exported, 10: w.report
  };
  let current = 1;
  for (let i = 1; i <= 10; i++) { if (stepDone[i]) current = Math.min(i + 1, 10); }
  document.querySelectorAll(".workflow-step").forEach(el => {
    const step = Number(el.dataset.step);
    el.classList.toggle("wf-done", !!stepDone[step]);
    el.classList.toggle("wf-current", step === current && !stepDone[step]);
  });
  UI.setStatus(w.experimentRun && !w.analyzed ? "running" : (App.state.dataset.length > 0 ? "collected" : "ready"));
};

UI.updateMiniDashboard = function () {
  const result = CalcEngine.computeIndicators(App.state.space, App.state.weights);
  document.getElementById("miniQuality").textContent = Utils.round1(result.composite.score);
  document.getElementById("miniRows").textContent = App.state.dataset.length;
  const exp = ExperimentEngine.getActive();
  document.getElementById("miniTrials").textContent = exp ? (exp.results ? exp.trials : 0) : 0;
  UI.updateWorkflowBar();
};

App.onSpaceChanged = function () {
  Viz.render();
  UI.updateMiniDashboard();
  if (document.getElementById("panel-variables").classList.contains("active")) UI.renderVariablesPanel();
  markDirty();
};

UI.openModal = function (id) { document.getElementById(id).hidden = false; };
UI.closeModal = function (id) { document.getElementById(id).hidden = true; };

UI.showCalcModal = function (indicatorId) {
  const def = CalcEngine.indicatorDef(indicatorId) || { label: indicatorId === "environmental" ? "Environmental Quality" : indicatorId, def: "" };
  const result = CalcEngine.computeIndicators(App.state.space, App.state.weights);
  const ind = result.indicators[indicatorId];
  document.getElementById("calcModalTitle").textContent = "Calculation — " + def.label;
  let html = "<p>" + (def.def || "") + "</p>";
  if (def.note) html += '<p class="hint small"><strong>' + def.note + "</strong></p>";
  html += '<div class="calc-formula">' + def.label + " =\n" + (def.components || []).map(c => "  " + Utils.round1(c.weight * 100) + "% × " + c.label + (c.invert ? " (inverted)" : "")).join("\n +\n") + "\n\n= " + Utils.round1(ind.score) + " / 100</div>";
  html += "<table><thead><tr><th>Component</th><th>Metric</th><th>Raw / Normalized</th><th>Used Value</th><th>Weight</th><th>Contribution</th></tr></thead><tbody>";
  ind.breakdown.forEach(b => {
    html += "<tr><td>" + b.label + "</td><td>" + (b.metricKey || "") + "</td><td>" + b.rawNormalized + "</td><td>" + b.usedValue + (b.invert ? " (inv.)" : "") + "</td><td>" + Math.round(b.weight * 100) + "%</td><td>" + b.contribution + "</td></tr>";
  });
  html += "</tbody></table>";
  html += '<p class="hint small">Output: 0–100. Higher values indicate stronger modeled potential under the specified assumptions. Interpret in relation to component variables; this is a model-based indicator, not a validated measurement.</p>';
  document.getElementById("calcModalBody").innerHTML = html;
  UI.openModal("calcModalOverlay");
};

function initCoreUI() {
  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => UI.switchTab(btn.dataset.tab)));
  document.getElementById("btnMobileNav").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.getElementById("btnProjectMenu").addEventListener("click", () => UI.switchTab("dataset"));
  document.getElementById("btnHelp").addEventListener("click", () => UI.openModal("helpModalOverlay"));
  document.getElementById("btnCloseHelpModal").addEventListener("click", () => UI.closeModal("helpModalOverlay"));
  document.getElementById("btnCloseCalcModal").addEventListener("click", () => UI.closeModal("calcModalOverlay"));
  [document.getElementById("calcModalOverlay"), document.getElementById("helpModalOverlay")].forEach(ov => {
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.hidden = true; });
  });
  document.getElementById("btnJumpLimitations").addEventListener("click", () => {
    UI.switchTab("report");
    document.getElementById("modelLimitations").scrollIntoView({ behavior: "smooth" });
  });
  document.querySelectorAll(".tab-strip").forEach(strip => {
    strip.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;
      const attrs = ["exptab", "obstab", "anatab", "reptab"];
      attrs.forEach(a => {
        if (btn.hasAttribute("data-" + a)) {
          const key = btn.getAttribute("data-" + a);
          strip.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
          document.querySelectorAll("[data-" + a + "panel]").forEach(p => p.classList.toggle("active", p.getAttribute("data-" + a + "panel") === key));
        }
      });
    });
  });
}

/* ===================== UI: RESEARCH QUESTION PANEL ===================== */
UI.renderQualityCheck = function () {
  const items = QualityCheck.items();
  const list = document.getElementById("qualityCheckList");
  list.innerHTML = items.map(i => '<div class="check-item"><span class="check-icon' + (i.ok ? " done" : "") + '">' + (i.ok ? "✓" : "") + "</span><span>" + i.label + "</span></div>").join("");
  document.getElementById("qualityCompletenessValue").textContent = QualityCheck.completeness() + "%";
};

function fillStudyForm() {
  const s = App.state.study;
  document.getElementById("studyTitle").value = s.title;
  document.getElementById("studyQuestion").value = s.question;
  document.getElementById("studyObjective").value = s.objective;
  document.getElementById("studyHypothesis").value = s.hypothesis;
  document.getElementById("studyIV").value = s.iv;
  document.getElementById("studyDV").value = s.dv;
  document.getElementById("studyControls").value = s.controls;
  document.getElementById("studyContext").value = s.context;
  document.getElementById("studyNotes").value = s.notes;
  document.querySelectorAll("#researchTypeGroup .chip").forEach(c => c.classList.toggle("active", c.dataset.value === s.type));
}
function readStudyForm() {
  const s = App.state.study;
  s.title = document.getElementById("studyTitle").value;
  s.question = document.getElementById("studyQuestion").value;
  s.objective = document.getElementById("studyObjective").value;
  s.hypothesis = document.getElementById("studyHypothesis").value;
  s.iv = document.getElementById("studyIV").value;
  s.dv = document.getElementById("studyDV").value;
  s.controls = document.getElementById("studyControls").value;
  s.context = document.getElementById("studyContext").value;
  s.notes = document.getElementById("studyNotes").value;
}

function initResearchQuestionUI() {
  document.getElementById("researchTypeGroup").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip"); if (!chip) return;
    App.state.study.type = chip.dataset.value;
    document.querySelectorAll("#researchTypeGroup .chip").forEach(c => c.classList.toggle("active", c === chip));
    markDirty();
  });
  ["studyTitle", "studyQuestion", "studyObjective", "studyHypothesis", "studyIV", "studyDV", "studyControls", "studyContext", "studyNotes"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => { readStudyForm(); UI.renderQualityCheck(); UI.updateWorkflowBar(); markDirty(); });
  });
  document.getElementById("btnSaveStudy").addEventListener("click", () => {
    readStudyForm();
    localStorage.setItem(STORAGE_KEY, JSON.stringify((() => { const p = Utils.deepClone(App.state); delete p.spaceHistory; delete p.selection; return p; })()));
    Utils.toast("Study saved.", "success");
    UI.renderQualityCheck(); UI.updateWorkflowBar();
  });
  document.getElementById("btnLoadStudy").addEventListener("click", () => {
    const saved = Store.load();
    if (!saved || !saved.study) { Utils.toast("No saved study found.", "error"); return; }
    App.state.study = saved.study;
    fillStudyForm(); UI.renderQualityCheck(); UI.updateWorkflowBar();
    Utils.toast("Study loaded from local storage.", "success");
  });
  document.getElementById("btnResetStudy").addEventListener("click", () => {
    if (!confirm("Reset the current research question fields? This does not affect your space configuration or dataset.")) return;
    App.state.study = defaultState().study;
    fillStudyForm(); UI.renderQualityCheck(); UI.updateWorkflowBar(); markDirty();
  });
  document.getElementById("btnLoadDemoStudy").addEventListener("click", () => { loadDemoStudy(); Utils.toast("Demo study loaded.", "success"); });
}

/* ===================== UI: SPACE BUILDER PANEL ===================== */
const RANGE_FIELDS = [
  { id: "geoOpenness", path: ["geometry", "openness"] }, { id: "geoEnclosure", path: ["geometry", "enclosure"] },
  { id: "parPathDirectness", path: ["params", "pathDirectness"] }, { id: "parPathConnectivity", path: ["params", "pathConnectivity"] },
  { id: "parSurfaceContinuity", path: ["params", "surfaceContinuity"] }, { id: "parCrossingComplexity", path: ["params", "crossingComplexity"] },
  { id: "parVisualObstruction", path: ["params", "visualObstruction"] }, { id: "parBlindSpots", path: ["params", "blindSpots"] },
  { id: "parNoise", path: ["params", "noise"] }, { id: "parCrowding", path: ["params", "crowding"] },
  { id: "parHardscape", path: ["params", "hardscape"] }, { id: "parBrightness", path: ["params", "brightness"] }
];
function getPath(obj, path) { return path.reduce((o, k) => o[k], obj); }
function setPath(obj, path, val) { const last = path[path.length - 1]; const parent = path.slice(0, -1).reduce((o, k) => o[k], obj); parent[last] = val; }

function fillSpaceForm() {
  document.getElementById("geoWidth").value = App.state.space.geometry.width;
  document.getElementById("geoLength").value = App.state.space.geometry.length;
  RANGE_FIELDS.forEach(f => {
    const el = document.getElementById(f.id);
    const v = getPath(App.state.space, f.path);
    el.value = v;
    el.nextElementSibling.textContent = v;
  });
  document.querySelectorAll("#timeConditionGroup .chip").forEach(c => c.classList.toggle("active", c.dataset.value === App.state.space.timeCondition));
}

function initSpaceBuilderUI() {
  document.getElementById("geoWidth").addEventListener("change", (e) => {
    SpaceHistory.beginEdit(); App.state.space.geometry.width = Utils.clamp(Number(e.target.value) || 10, 5, 300); SpaceHistory.commitEdit();
    LogManager.add("Geometry changed", "width", "", App.state.space.geometry.width);
    App.onSpaceChanged();
  });
  document.getElementById("geoLength").addEventListener("change", (e) => {
    SpaceHistory.beginEdit(); App.state.space.geometry.length = Utils.clamp(Number(e.target.value) || 10, 5, 300); SpaceHistory.commitEdit();
    LogManager.add("Geometry changed", "length", "", App.state.space.geometry.length);
    App.onSpaceChanged();
  });

  RANGE_FIELDS.forEach(f => {
    const el = document.getElementById(f.id);
    let preVal = null;
    el.addEventListener("pointerdown", () => { preVal = getPath(App.state.space, f.path); SpaceHistory.beginEdit(); });
    el.addEventListener("input", (e) => {
      setPath(App.state.space, f.path, Number(e.target.value));
      el.nextElementSibling.textContent = e.target.value;
      Viz.render(); UI.updateMiniDashboard();
      if (document.getElementById("panel-variables").classList.contains("active")) UI.renderVariablesPanel();
    });
    el.addEventListener("change", (e) => {
      SpaceHistory.commitEdit();
      LogManager.add("Parameter changed", f.path.join("."), preVal, e.target.value);
      markDirty();
    });
  });

  document.getElementById("timeConditionGroup").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip"); if (!chip) return;
    SpaceHistory.beginEdit();
    App.state.space.timeCondition = chip.dataset.value;
    SpaceHistory.commitEdit();
    document.querySelectorAll("#timeConditionGroup .chip").forEach(c => c.classList.toggle("active", c === chip));
    LogManager.add("Time condition changed", "timeCondition", "", chip.dataset.value);
    App.onSpaceChanged();
  });

  document.getElementById("presetSelect").addEventListener("change", (e) => {
    const key = e.target.value;
    if (!key || key === "custom") return;
    App.state.editingCondition = null;
    SpaceHistory.beginEdit();
    const newSpace = Presets.build(key);
    if (newSpace) {
      App.state.space = newSpace;
      App.state.selection = null;
      SpaceHistory.commitEdit();
      LogManager.add("Preset applied", "space", "", key);
      fillSpaceForm();
      App.onSpaceChanged();
      Utils.toast("Preset applied: " + Presets.describe(key), "success");
    }
  });

  document.getElementById("addToolGroup").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add]"); if (!btn) return;
    Viz.addObjectFromTool(btn.dataset.add);
  });

  document.getElementById("btnUndo").addEventListener("click", () => { if (SpaceHistory.undo()) { App.state.selection = null; App.onSpaceChanged(); renderPropertiesPanel(); } });
  document.getElementById("btnRedo").addEventListener("click", () => { if (SpaceHistory.redo()) { App.state.selection = null; App.onSpaceChanged(); renderPropertiesPanel(); } });
  document.getElementById("btnRandomize").addEventListener("click", () => { Viz.randomize(App.state.spaceSeed + Math.floor(Math.random() * 1000)); renderPropertiesPanel(); });
  document.getElementById("btnClearSpace").addEventListener("click", () => {
    if (!confirm("Clear all objects from the current space? Geometry and parameters are kept.")) return;
    Viz.clearSpace(); renderPropertiesPanel();
  });

  document.getElementById("heatmapSelect").addEventListener("change", Viz.render);
  document.getElementById("heatmapOpacity").addEventListener("input", Viz.render);

  document.getElementById("btnSaveSnapshot").addEventListener("click", () => {
    const name = prompt("Snapshot name:", "Snapshot " + (App.state.snapshots.length + 1));
    if (name === null) return;
    SnapshotManager.save(name);
    renderSnapshotList();
    Utils.toast("Snapshot saved.", "success");
  });

  Viz.init();
}

function renderSnapshotList() {
  const list = document.getElementById("snapshotList");
  const snaps = SnapshotManager.list();
  if (!snaps.length) { list.innerHTML = '<p class="hint small">No snapshots saved yet.</p>'; return; }
  list.innerHTML = snaps.map(s => (
    '<div class="mini-list-item"><span>' + s.name + '<br/><span class="hint small">' + Utils.fmtTime(s.timestamp) + '</span></span>' +
    '<span class="mli-actions"><button class="btn btn-xs" data-restore="' + s.id + '">Restore</button><button class="btn btn-xs btn-danger-outline" data-remove-snap="' + s.id + '">✕</button></span></div>'
  )).join("");
  list.querySelectorAll("[data-restore]").forEach(b => b.addEventListener("click", () => {
    if (SnapshotManager.restore(b.dataset.restore)) { fillSpaceForm(); App.onSpaceChanged(); Utils.toast("Snapshot restored.", "success"); }
  }));
  list.querySelectorAll("[data-remove-snap]").forEach(b => b.addEventListener("click", () => { SnapshotManager.remove(b.dataset.removeSnap); renderSnapshotList(); }));
}

/* --- Properties panel for selected canvas object --- */
function renderPropertiesPanel() {
  const container = document.getElementById("propertiesContent");
  const sel = App.state.selection;
  if (!sel) { container.innerHTML = '<p class="hint">No object selected. Click an object on the canvas, or add one using the toolbar above.</p>'; return; }
  const obj = App.state.space.objects[sel.cat].find(o => o.id === sel.id);
  if (!obj) { container.innerHTML = '<p class="hint">Object no longer exists.</p>'; App.state.selection = null; return; }

  const optionsHtml = (arr, current) => arr.map(v => '<option value="' + v + '"' + (v === current ? " selected" : "") + ">" + v + "</option>").join("");
  let html = '<p class="hint small">Selected: <strong>' + sel.cat.slice(0, -1) + "</strong></p>";

  function numField(label, key, val, min, max, step) {
    return '<label class="field"><span>' + label + '</span><input type="number" data-field="' + key + '" data-kind="number" value="' + val + '" min="' + min + '" max="' + max + '" step="' + (step || 1) + '"/></label>';
  }
  function selField(label, key, options, val) {
    return '<label class="field"><span>' + label + '</span><select data-field="' + key + '" data-kind="select">' + optionsHtml(options, val) + '</select></label>';
  }

  if (sel.cat === "entrances") html += numField("Width (m)", "width", obj.width || 3, 1, 12, 0.5);
  else if (sel.cat === "pathways") html += numField("Width (m)", "width", obj.width || 2.5, 0.5, 10, 0.5);
  else if (sel.cat === "seats") html += selField("Seating Type", "type", SpaceModel.SEAT_TYPES, obj.type) + numField("Group Size", "groupSize", obj.groupSize || 1, 1, 20, 1);
  else if (sel.cat === "trees") html += numField("Canopy Radius (m)", "canopy", obj.canopy || 4, 1, 12, 0.5);
  else if (sel.cat === "shades") html += selField("Shade Type", "type", SpaceModel.SHADE_TYPES, obj.type) + numField("Radius (%)", "radius", obj.radius || 20, 5, 60, 1);
  else if (sel.cat === "lights") html += numField("Brightness (0-100)", "brightness", obj.brightness || 60, 0, 100, 5);
  else if (sel.cat === "water") html += numField("Size (radius)", "radius", obj.radius || 10, 2, 40, 1);
  else if (sel.cat === "edges") html += selField("Edge Type", "type", SpaceModel.EDGE_TYPES, obj.type) + numField("Length (m)", "length", obj.length || 8, 2, 40, 1);
  else if (sel.cat === "nodes") html += selField("Activity Type", "type", SpaceModel.NODE_TYPES, obj.type);
  else if (sel.cat === "obstacles") html += numField("Width (m)", "width", obj.width || 6, 1, 30, 1) + numField("Height (m)", "height", obj.height || 6, 1, 30, 1);

  html += '<div class="action-row"><button class="btn btn-sm btn-danger-outline" id="btnDeleteSelected">Delete Object</button><button class="btn btn-sm" id="btnDeselect">Deselect</button></div>';
  container.innerHTML = html;

  container.querySelectorAll("[data-field]").forEach(input => {
    input.addEventListener("change", (e) => {
      SpaceHistory.beginEdit();
      const key = e.target.dataset.field;
      const value = e.target.dataset.kind === "number" ? Number(e.target.value) : e.target.value;
      const old = obj[key];
      obj[key] = value;
      SpaceHistory.commitEdit();
      LogManager.add("Object property changed", sel.cat + "." + key, old, value);
      App.onSpaceChanged();
    });
  });
  document.getElementById("btnDeleteSelected").addEventListener("click", Viz.deleteSelected);
  document.getElementById("btnDeselect").addEventListener("click", () => { Viz.selectObject(null); });
}
App.renderPropertiesPanel = renderPropertiesPanel;

/* ===================== UI: VARIABLES PANEL ===================== */
UI.renderVariablesPanel = function () {
  const result = CalcEngine.computeIndicators(App.state.space, App.state.weights);
  document.getElementById("qualityScoreValue").textContent = Utils.round1(result.composite.score);
  const bd = document.getElementById("qualityBreakdown");
  bd.innerHTML = result.composite.breakdown.map(c => (
    '<div class="qb-item"><div class="qb-label"><span>' + c.label + '</span><span>' + c.score + '</span></div>' +
    '<div class="qb-bar"><div class="qb-bar-fill" style="width:' + c.score + '%"></div></div></div>'
  )).join("");

  const cont = document.getElementById("indicatorCategories");
  const custom = App.state.customWeightsEnabled;
  cont.innerHTML = IndicatorDefs.map(def => {
    const ind = result.indicators[def.id];
    const inputsHtml = def.components.map(c => {
      const w = App.state.weights.indicators[def.id][c.key];
      return '<div class="ind-input-row"><span>' + c.label + (c.invert ? " (inv.)" : "") + '</span>' +
        '<input type="number" min="0" max="1" step="0.05" data-weight-ind="' + def.id + '" data-weight-key="' + c.key + '" value="' + Utils.round1(w * 100) / 100 + '" ' + (custom ? "" : "disabled") + '/></div>';
    }).join("");
    return '<div class="indicator-card">' +
      '<h4>' + def.label + (def.note ? ' <span class="badge badge-model">' + def.note + '</span>' : ' <span class="badge badge-model">Model-based indicator</span>') + '</h4>' +
      '<div class="ind-value">' + Utils.round1(ind.score) + ' <span style="font-size:12px;color:var(--text-muted);">/ 100</span></div>' +
      '<div class="ind-def">' + def.def + '</div>' +
      '<div class="ind-inputs">' + inputsHtml + '</div>' +
      '<div class="action-row"><button class="btn btn-xs" data-view-calc="' + def.id + '">View Calculation</button></div>' +
      '</div>';
  }).join("") + '<div class="indicator-card"><h4>Environmental Quality <span class="badge badge-model">Derived (avg. of Comfort + Thermal)</span></h4>' +
    '<div class="ind-value">' + Utils.round1(result.indicators.environmental.score) + ' <span style="font-size:12px;color:var(--text-muted);">/ 100</span></div>' +
    '<div class="ind-def">Average of the Environmental Comfort Index and Thermal Comfort Potential.</div>' +
    '<div class="action-row"><button class="btn btn-xs" data-view-calc="environmental">View Calculation</button></div></div>';

  cont.querySelectorAll("[data-view-calc]").forEach(b => b.addEventListener("click", () => UI.showCalcModal(b.dataset.viewCalc)));
  cont.querySelectorAll("[data-weight-ind]").forEach(inp => {
    inp.addEventListener("change", (e) => {
      const id = e.target.dataset.weightInd, key = e.target.dataset.weightKey;
      App.state.weights.indicators[id][key] = Utils.clamp(Number(e.target.value) || 0, 0, 1);
      LogManager.add("Weight changed", id + "." + key, "", e.target.value);
      App.onSpaceChanged(); UI.renderVariablesPanel();
    });
  });
};

function initVariablesUI() {
  document.getElementById("btnDefaultWeights").addEventListener("click", () => {
    App.state.weights = WeightsManager.defaultWeights();
    App.state.customWeightsEnabled = false;
    LogManager.add("Weights reset to default", "weights", "", "default");
    UI.renderVariablesPanel(); markDirty();
    Utils.toast("Default weights restored.", "success");
  });
  document.getElementById("btnCustomWeights").addEventListener("click", () => {
    App.state.customWeightsEnabled = !App.state.customWeightsEnabled;
    document.getElementById("btnCustomWeights").textContent = App.state.customWeightsEnabled ? "Disable Custom Weights" : "Enable Custom Weights";
    UI.renderVariablesPanel(); markDirty();
  });
  document.getElementById("btnNormalizeWeights").addEventListener("click", () => {
    App.state.weights = WeightsManager.normalizeAll(App.state.weights);
    LogManager.add("Weights normalized", "weights", "", "normalized");
    UI.renderVariablesPanel(); markDirty();
    Utils.toast("Weights normalized so each group sums to 1.0.", "success");
  });
  document.getElementById("btnResetWeights").addEventListener("click", () => {
    if (!confirm("Reset all custom weights to defaults?")) return;
    App.state.weights = WeightsManager.defaultWeights();
    App.state.customWeightsEnabled = false;
    document.getElementById("btnCustomWeights").textContent = "Enable Custom Weights";
    UI.renderVariablesPanel(); markDirty();
  });
}

/* ===================== UI: EXPERIMENT PANEL ===================== */
function fillExperimentForm(exp) {
  document.getElementById("expId").value = exp ? exp.id : ExperimentEngine.nextExperimentId();
  document.getElementById("expName").value = exp ? exp.name || "" : "";
  document.getElementById("expQuestion").value = exp ? exp.question || "" : App.state.study.question || "";
  document.getElementById("expHypothesis").value = exp ? exp.hypothesis || "" : App.state.study.hypothesis || "";
  document.getElementById("expIV").value = exp ? exp.iv || "" : App.state.study.iv || "";
  document.getElementById("expDV").value = exp ? exp.dv || "" : App.state.study.dv || "";
  document.getElementById("expControls").value = exp ? exp.controls || "" : App.state.study.controls || "";
  document.getElementById("expTrials").value = exp ? exp.trials || 5 : 5;
  document.getElementById("expReplication").value = exp ? exp.replication || 3 : 3;
  document.getElementById("expSeed").value = exp ? exp.seed || 12345 : 12345;
  document.getElementById("expNotes").value = exp ? exp.notes || "" : "";
}

function renderExperimentList() {
  const list = document.getElementById("experimentList");
  if (!App.state.experiments.length) { list.innerHTML = '<p class="hint small">No experiments defined yet.</p>'; return; }
  list.innerHTML = App.state.experiments.map(e => (
    '<div class="mini-list-item"><span><strong>' + e.id + '</strong> — ' + (e.name || "(unnamed)") + (e.results ? ' <span class="badge badge-model">has results</span>' : '') + '</span>' +
    '<span class="mli-actions"><button class="btn btn-xs" data-load-exp="' + e.id + '">Load</button><button class="btn btn-xs btn-danger-outline" data-del-exp="' + e.id + '">✕</button></span></div>'
  )).join("");
  list.querySelectorAll("[data-load-exp]").forEach(b => b.addEventListener("click", () => {
    App.state.activeExperimentId = b.dataset.loadExp;
    fillExperimentForm(ExperimentEngine.getById(b.dataset.loadExp));
    Utils.toast("Experiment loaded.", "success");
  }));
  list.querySelectorAll("[data-del-exp]").forEach(b => b.addEventListener("click", () => {
    if (!confirm("Delete this experiment definition? Dataset rows already collected are kept.")) return;
    ExperimentEngine.removeExperiment(b.dataset.delExp);
    renderExperimentList(); fillExperimentForm(null);
  }));
}

function renderConditionSummaries() {
  const b = App.state.conditions.baseline, t = App.state.conditions.treatment;
  function summarize(cond) {
    if (!cond) return "Not set.";
    const r = CalcEngine.computeIndicators(cond.space, App.state.weights);
    const o = cond.space.objects;
    return "Name: " + cond.name + "\nSaved: " + Utils.fmtTime(cond.timestamp) +
      "\nEntrances: " + o.entrances.length + " | Seats: " + o.seats.length + " | Trees: " + o.trees.length + " | Lights: " + o.lights.length +
      "\nPublic Space Quality Score: " + Utils.round1(r.composite.score);
  }
  document.getElementById("baselineSummary").textContent = summarize(b);
  document.getElementById("treatmentSummary").textContent = summarize(t);
  const lockEl = document.getElementById("lockIndicator");
  lockEl.textContent = App.state.lockedControls.length ? "🔒 LOCKED (" + App.state.lockedControls.length + " variables)" : "UNLOCKED";
  lockEl.classList.toggle("locked", App.state.lockedControls.length > 0);
}

function renderControlledResults(r) {
  const el = document.getElementById("controlledResults");
  if (!r) { el.innerHTML = '<p class="hint">No controlled experiment has been run yet.</p>'; return; }
  el.innerHTML =
    '<div class="stats-grid">' +
    '<div class="stat-box"><div class="stat-val">' + r.baseline.stats.mean + '</div><div class="stat-lab">Baseline Mean</div></div>' +
    '<div class="stat-box"><div class="stat-val">' + r.treatment.stats.mean + '</div><div class="stat-lab">Treatment Mean</div></div>' +
    '<div class="stat-box"><div class="stat-val">' + r.meanDifference + '</div><div class="stat-lab">Mean Difference</div></div>' +
    '<div class="stat-box"><div class="stat-val">' + (r.pctChange === null ? "n/a" : r.pctChange + "%") + '</div><div class="stat-lab">% Change</div></div>' +
    '<div class="stat-box"><div class="stat-val">' + (r.smd === null ? "n/a" : r.smd) + '</div><div class="stat-lab">Std. Mean Diff. (effect size)</div></div>' +
    '</div>' +
    '<p class="hint small">Measured indicator: <strong>' + r.dvLabel + '</strong> (model-based). Trials: ' + r.trials + '. Stochastic variation: ' + (r.stochastic ? "enabled" : "disabled (deterministic)") + '.</p>' +
    '<p class="hint">Model indicator changed by ' + (r.pctChange === null ? "an indeterminate amount" : r.pctChange + "%") + ' from baseline to treatment. This describes a change in the <em>model-based indicator</em>, not a direct claim about real-world ' + r.dvLabel.toLowerCase() + '.</p>' +
    '<div class="chart-wrap"><svg id="controlledChart" viewBox="0 0 400 260"></svg></div>';
  Charts.barChart(document.getElementById("controlledChart"), ["Baseline", "Treatment"], [r.baseline.stats.mean, r.treatment.stats.mean]);
}

function initExperimentUI() {
  fillExperimentForm(null);
  document.getElementById("btnCreateExperiment").addEventListener("click", () => {
    const fields = {
      id: document.getElementById("expId").value || ExperimentEngine.nextExperimentId(),
      name: document.getElementById("expName").value, question: document.getElementById("expQuestion").value,
      hypothesis: document.getElementById("expHypothesis").value, iv: document.getElementById("expIV").value,
      dv: document.getElementById("expDV").value, controls: document.getElementById("expControls").value,
      trials: Utils.clamp(Number(document.getElementById("expTrials").value) || 5, 1, 50),
      replication: Utils.clamp(Number(document.getElementById("expReplication").value) || 3, 1, 20),
      seed: Number(document.getElementById("expSeed").value) || 12345, notes: document.getElementById("expNotes").value
    };
    const exp = ExperimentEngine.createOrUpdate(fields);
    fillExperimentForm(exp); renderExperimentList();
    Utils.toast("Experiment saved: " + exp.id, "success");
  });
  document.getElementById("btnLoadDemoExperiment").addEventListener("click", () => { loadDemoExperiment(); Utils.toast("Demo experiment loaded.", "success"); });

  document.getElementById("btnSetBaseline").addEventListener("click", () => { App.state.editingCondition = null; ExperimentEngine.setBaseline(); renderConditionSummaries(); UI.updateWorkflowBar(); Utils.toast("Baseline set from current space.", "success"); });
  document.getElementById("btnDuplicateToTreatment").addEventListener("click", () => {
    if (!ExperimentEngine.duplicateToTreatment()) { Utils.toast("Set a baseline first.", "error"); return; }
    renderConditionSummaries(); UI.updateWorkflowBar();
    Utils.toast("Treatment duplicated. Edit ONLY the independent variable in Space Builder, then lock controls.", "success");
  });
  document.getElementById("btnLockControls").addEventListener("click", () => {
    const controls = (document.getElementById("expControls").value || App.state.study.controls || "").split(",").map(s => s.trim()).filter(Boolean);
    if (!controls.length) { Utils.toast("Enter control variables in the Design tab first.", "error"); return; }
    ExperimentEngine.lockControls(controls);
    renderConditionSummaries(); UI.updateWorkflowBar();
    Utils.toast("Control variables locked.", "success");
  });
  document.getElementById("btnEditTreatment").addEventListener("click", () => {
    if (!App.state.conditions.treatment) { Utils.toast("Duplicate the baseline to create a treatment first.", "error"); return; }
    SpaceHistory.beginEdit();
    App.state.space = Utils.deepClone(App.state.conditions.treatment.space);
    SpaceHistory.commitEdit();
    App.state.editingCondition = "treatment";
    UI.switchTab("space-builder"); fillSpaceForm(); Viz.render();
    Utils.toast("Editing Treatment space. Change only the independent variable, then return here to update Treatment.", "success");
  });
  document.getElementById("btnRunControlled").addEventListener("click", () => {
    if (App.state.editingCondition === "treatment" && App.state.conditions.treatment) {
      App.state.conditions.treatment.space = Utils.deepClone(App.state.space);
    }
    const r = ExperimentEngine.runControlled();
    if (!r) { Utils.toast("Set both Baseline and Treatment first.", "error"); return; }
    renderControlledResults(r); UI.updateMiniDashboard();
    Utils.toast("Controlled experiment run.", "success");
  });

  document.getElementById("btnRunParametric").addEventListener("click", () => {
    const varKey = document.getElementById("paramVariable").value;
    const levels = document.getElementById("paramLevels").value.split(",").map(s => Number(s.trim())).filter(v => !isNaN(v));
    if (!levels.length) { Utils.toast("Enter valid numeric levels.", "error"); return; }
    const rows = ExperimentEngine.runParametric(varKey, levels);
    const table = document.getElementById("paramResultsTable");
    table.innerHTML = "<table><thead><tr><th>Condition</th><th>" + ExperimentEngine.varLabel(varKey) + "</th><th>Comfort</th><th>Social Interaction</th><th>Accessibility</th><th>Quality Score</th></tr></thead><tbody>" +
      rows.map((r, i) => "<tr><td>" + String.fromCharCode(65 + i) + "</td><td>" + r.level + "</td><td>" + r.comfort + "</td><td>" + r.social + "</td><td>" + r.accessibility + "</td><td>" + r.quality + "</td></tr>").join("") + "</tbody></table>";
    Charts.lineChart(document.getElementById("paramChart"), rows.map(r => r.level), [
      { name: "Quality", values: rows.map(r => r.quality), color: "#1f6feb" },
      { name: "Comfort", values: rows.map(r => r.comfort), color: "#1c8a5a" },
      { name: "Social", values: rows.map(r => r.social), color: "#b4750a" }
    ]);
    UI.updateMiniDashboard();
    Utils.toast("Parametric study complete.", "success");
  });

  document.getElementById("btnRunSensitivity").addEventListener("click", () => {
    const varKey = document.getElementById("sensVariable").value, indKey = document.getElementById("sensIndicator").value;
    const rows = ExperimentEngine.runSensitivity(varKey, indKey);
    const table = document.getElementById("sensResultsTable");
    table.innerHTML = "<table><thead><tr><th>Variable Change</th><th>" + ExperimentEngine.varLabel(varKey) + " Value</th><th>Indicator Value</th><th>Indicator Change</th><th>Sensitivity</th></tr></thead><tbody>" +
      rows.map(r => "<tr><td>" + (r.variableChangePct > 0 ? "+" : "") + r.variableChangePct + "%</td><td>" + r.variableValue + "</td><td>" + r.indicatorValue + "</td><td>" + (r.indicatorChangePct > 0 ? "+" : "") + r.indicatorChangePct + "%</td><td>" + (r.sensitivity === null ? "baseline" : r.sensitivity) + "</td></tr>").join("") + "</tbody></table>";
    Charts.lineChart(document.getElementById("sensChart"), rows.map(r => r.variableChangePct + "%"), [{ name: ExperimentEngine.indicatorLabelForKey(indKey), values: rows.map(r => r.indicatorValue) }]);
    const maxAbsSens = Math.max(...rows.filter(r => r.sensitivity !== null).map(r => Math.abs(r.sensitivity)), 0);
    document.getElementById("sensInterpretation").textContent = "Within this model, the selected indicator (" + ExperimentEngine.indicatorLabelForKey(indKey) + ") shows a maximum sensitivity magnitude of " + Utils.round1(maxAbsSens) + " to changes in " + ExperimentEngine.varLabel(varKey) + ". This describes model behavior only and should not be read as a causal real-world relationship without empirical validation.";
    UI.updateMiniDashboard();
    Utils.toast("Sensitivity analysis complete.", "success");
  });

  document.getElementById("btnAddCondition").addEventListener("click", () => {
    const name = prompt("Condition name:", "Condition " + String.fromCharCode(65 + App.state.conditions.list.length));
    if (name === null) return;
    const cond = ExperimentEngine.addCondition(name);
    if (cond) { renderConditionList(); Utils.toast("Condition added.", "success"); }
  });

  document.getElementById("stochasticToggle").addEventListener("change", (e) => { App.state.settings.stochasticEnabled = e.target.checked; markDirty(); });
  document.getElementById("stochasticLevel").addEventListener("change", (e) => { App.state.settings.stochasticLevel = Number(e.target.value); markDirty(); });
  document.getElementById("btnRunTrials").addEventListener("click", () => {
    const exp = ExperimentEngine.getActive();
    const trials = exp ? exp.trials : 5;
    const result = ExperimentEngine.runReplicationTrials(trials);
    const table = document.getElementById("replicationTable");
    table.innerHTML = "<table><thead><tr><th>Trial</th><th>Condition</th><th>Seed</th><th>" + result.label + "</th><th>Notes</th></tr></thead><tbody>" +
      result.rows.map(r => "<tr><td>" + r.trial + "</td><td>" + r.condition + "</td><td>" + r.seed + "</td><td>" + r.value + "</td><td>" + r.notes + "</td></tr>").join("") + "</tbody></table>";
    UI.updateMiniDashboard();
    Utils.toast("Replication trials complete.", "success");
  });

  renderExperimentList(); renderConditionSummaries(); renderConditionList();
}

function renderConditionList() {
  const list = document.getElementById("conditionList");
  const conds = App.state.conditions.list;
  if (!conds.length) { list.innerHTML = '<p class="hint small">No multi-conditions added yet.</p>'; document.getElementById("conditionComparisonTable").innerHTML = ""; Charts.clear(document.getElementById("conditionChart")); return; }
  list.innerHTML = conds.map(c => (
    '<div class="mini-list-item"><span>' + c.name + '</span><span class="mli-actions"><button class="btn btn-xs btn-danger-outline" data-del-cond="' + c.id + '">✕</button></span></div>'
  )).join("");
  list.querySelectorAll("[data-del-cond]").forEach(b => b.addEventListener("click", () => { ExperimentEngine.removeCondition(b.dataset.delCond); renderConditionList(); }));

  const results = conds.map(c => ({ name: c.name, result: CalcEngine.computeIndicators(c.space, App.state.weights) }));
  Charts.barChart(document.getElementById("conditionChart"), results.map(r => r.name), results.map(r => Utils.round1(r.result.composite.score)));

  const keys = ["accessibility", "walkability", "visibility", "safety", "social", "comfort", "privacy", "sociability", "activityDiversity"];
  let html = "<table><thead><tr><th>Indicator</th>" + results.map(r => "<th>" + r.name + "</th>").join("") + "</tr></thead><tbody>";
  keys.forEach(k => {
    html += "<tr><td>" + CalcEngine.indicatorLabel(k) + "</td>" + results.map(r => "<td>" + Utils.round1(r.result.indicators[k].score) + "</td>").join("") + "</tr>";
  });
  html += "<tr><td><strong>Quality Score</strong></td>" + results.map(r => "<td><strong>" + Utils.round1(r.result.composite.score) + "</strong></td>").join("") + "</tr></tbody></table>";
  document.getElementById("conditionComparisonTable").innerHTML = html;
}

/* ===================== UI: OBSERVATIONS PANEL ===================== */
function renderObservationTable() {
  const table = document.getElementById("observationTable");
  const obs = ObservationManager.list();
  const cols = ["Time", "Location", "Condition", "Pedestrians", "Seated", "Interactions", "Duration(min)", "Comfort", "Safety", "Notes"];
  table.querySelector("thead") ? (table.innerHTML = "") : null;
  let html = "<thead><tr>" + cols.map(c => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>";
  if (!obs.length) html += '<tr><td colspan="' + cols.length + '" class="hint">No observations recorded yet.</td></tr>';
  obs.forEach(o => {
    html += "<tr><td>" + Utils.fmtTime(o.timestamp) + "</td><td>" + (o.location || "") + "</td><td>" + (o.condition || "") + "</td><td>" + (o.pedestrians || 0) +
      "</td><td>" + (o.seated || 0) + "</td><td>" + (o.interactions || 0) + "</td><td>" + (o.duration || 0) + "</td><td>" + (o.comfort || "") + "</td><td>" + (o.safety || "") + "</td><td>" + (o.notes || "") + "</td></tr>";
  });
  html += "</tbody>";
  table.innerHTML = html;
}

function initObservationsUI() {
  document.getElementById("btnAddObservation").addEventListener("click", () => {
    const fields = {
      location: document.getElementById("obsLocation").value, condition: document.getElementById("obsCondition").value,
      pedestrians: Number(document.getElementById("obsPedestrians").value) || 0, seated: Number(document.getElementById("obsSeated").value) || 0,
      standing: Number(document.getElementById("obsStanding").value) || 0, walking: Number(document.getElementById("obsWalking").value) || 0,
      groups: Number(document.getElementById("obsGroups").value) || 0, solo: Number(document.getElementById("obsSolo").value) || 0,
      interactions: Number(document.getElementById("obsInteractions").value) || 0, duration: Number(document.getElementById("obsDuration").value) || 0,
      activities: document.getElementById("obsActivities").value, conflicts: Number(document.getElementById("obsConflicts").value) || 0,
      noise: Number(document.getElementById("obsNoise").value) || null, comfort: Number(document.getElementById("obsComfort").value) || null,
      safety: Number(document.getElementById("obsSafety").value) || null, accessProblems: document.getElementById("obsAccessProblems").value,
      notes: document.getElementById("obsNotes").value
    };
    ObservationManager.add(fields);
    renderObservationTable(); UI.updateWorkflowBar();
    ["obsLocation", "obsCondition", "obsPedestrians", "obsSeated", "obsStanding", "obsWalking", "obsGroups", "obsSolo", "obsInteractions", "obsDuration", "obsActivities", "obsConflicts", "obsNoise", "obsComfort", "obsSafety", "obsAccessProblems", "obsNotes"].forEach(id => document.getElementById(id).value = "");
    Utils.toast("Observation recorded (researcher-entered observation).", "success");
  });
  renderObservationTable();
  renderQuestionList();
  renderLikertForm();
  document.getElementById("participantId").value = ParticipantManager.nextParticipantId();

  document.getElementById("btnAddQuestion").addEventListener("click", () => {
    const text = document.getElementById("newQuestionText").value;
    if (!text.trim()) return;
    ParticipantManager.addQuestion(text);
    document.getElementById("newQuestionText").value = "";
    renderQuestionList(); renderLikertForm();
  });
  document.getElementById("btnSubmitResponse").addEventListener("click", () => {
    const pid = document.getElementById("participantId").value || ParticipantManager.nextParticipantId();
    const cond = document.getElementById("participantCondition").value;
    const answers = {};
    let answeredAll = true;
    App.state.participants.questions.forEach(q => {
      const checked = document.querySelector('input[name="likert-' + q.id + '"]:checked');
      if (checked) answers[q.id] = Number(checked.value); else answeredAll = false;
    });
    if (!App.state.participants.questions.length) { Utils.toast("Add at least one question first.", "error"); return; }
    if (!answeredAll) { Utils.toast("Please answer every question (1–5) before submitting.", "error"); return; }
    ParticipantManager.addResponse(pid, cond, answers);
    document.getElementById("participantId").value = ParticipantManager.nextParticipantId();
    renderLikertForm(); renderResponseSummary(); UI.updateWorkflowBar();
    Utils.toast("Participant response recorded (participant-reported response). No PII collected.", "success");
  });
}

function renderQuestionList() {
  const list = document.getElementById("questionList");
  list.innerHTML = App.state.participants.questions.map(q => (
    '<div class="mini-list-item"><span>' + q.text + '</span><button class="btn btn-xs btn-danger-outline" data-del-q="' + q.id + '">✕</button></div>'
  )).join("");
  list.querySelectorAll("[data-del-q]").forEach(b => b.addEventListener("click", () => { ParticipantManager.removeQuestion(b.dataset.delQ); renderQuestionList(); renderLikertForm(); renderResponseSummary(); }));
}

function renderLikertForm() {
  const form = document.getElementById("likertForm");
  const scaleLabels = ["1 Strongly disagree", "2 Disagree", "3 Neutral", "4 Agree", "5 Strongly agree"];
  form.innerHTML = App.state.participants.questions.map(q => (
    '<div class="field" style="margin-bottom:10px;"><span>' + q.text + '</span><div class="chip-group">' +
    [1, 2, 3, 4, 5].map(v => '<label class="chip" style="cursor:pointer;"><input type="radio" name="likert-' + q.id + '" value="' + v + '" style="margin-right:4px;" title="' + scaleLabels[v - 1] + '"/>' + v + '</label>').join("") +
    '</div></div>'
  )).join("") || '<p class="hint small">No questions defined yet.</p>';
  renderResponseSummary();
}

function renderResponseSummary() {
  const el = document.getElementById("responseSummary");
  if (!App.state.participants.responses.length) { el.innerHTML = '<p class="hint small">No participant responses recorded yet.</p>'; return; }
  el.innerHTML = "<p class=\"hint small\">Total participants: " + App.state.participants.responses.length + "</p>" +
    App.state.participants.questions.map(q => {
      const s = ParticipantManager.questionStats(q.id);
      return '<div style="margin-bottom:10px;"><strong>' + q.text + '</strong><div class="stats-grid">' +
        '<div class="stat-box"><div class="stat-val">' + s.mean + '</div><div class="stat-lab">Mean</div></div>' +
        '<div class="stat-box"><div class="stat-val">' + s.median + '</div><div class="stat-lab">Median</div></div>' +
        '<div class="stat-box"><div class="stat-val">' + s.sd + '</div><div class="stat-lab">SD</div></div>' +
        '<div class="stat-box"><div class="stat-val">' + s.n + '</div><div class="stat-lab">n</div></div>' +
        '</div><div class="hint small">Distribution (1–5): ' + s.dist.join(" / ") + '</div></div>';
    }).join("");
}

/* ===================== UI: ANALYSIS PANEL ===================== */
function getSampleUnits() {
  const units = [];
  if (App.state.conditions.baseline) units.push({ label: "Baseline", space: App.state.conditions.baseline.space });
  if (App.state.conditions.treatment) units.push({ label: "Treatment", space: App.state.conditions.treatment.space });
  App.state.conditions.list.forEach(c => units.push({ label: c.name, space: c.space }));
  App.state.snapshots.forEach(s => units.push({ label: s.name, space: s.space }));
  if (!units.length) units.push({ label: "Current Space", space: App.state.space });
  return units;
}
const CORR_VARS = [
  { key: "treeCount", label: "Tree Count", get: (s) => s.objects.trees.length },
  { key: "seatCount", label: "Seating Count", get: (s) => s.objects.seats.length },
  { key: "entranceCount", label: "Entrance Count", get: (s) => s.objects.entrances.length },
  { key: "lightCount", label: "Lighting Count", get: (s) => s.objects.lights.length },
  { key: "waterCount", label: "Water Features", get: (s) => s.objects.water.length },
  { key: "obstacleCount", label: "Obstacle Count", get: (s) => s.objects.obstacles.length },
  { key: "hardscape", label: "Hardscape Ratio", get: (s) => s.params.hardscape },
  { key: "accessibility", label: "Accessibility Index", get: (s, r) => r.indicators.accessibility.score },
  { key: "comfort", label: "Environmental Comfort Index", get: (s, r) => r.indicators.comfort.score },
  { key: "social", label: "Social Interaction Potential", get: (s, r) => r.indicators.social.score },
  { key: "safety", label: "Perceived Safety Potential", get: (s, r) => r.indicators.safety.score },
  { key: "quality", label: "Public Space Quality Score", get: (s, r) => r.composite.score }
];

function populateAnalysisSelectors() {
  const descField = document.getElementById("descField");
  descField.innerHTML = '<option value="simulation">Dependent Value — Simulation rows</option><option value="observation">Dependent Value — Field Observation rows</option><option value="participant">Dependent Value — Participant Response rows</option><option value="">Dependent Value — All rows</option>';

  const units = getSampleUnits();
  [document.getElementById("scenarioA"), document.getElementById("scenarioB")].forEach((sel, i) => {
    sel.innerHTML = units.map((u, idx) => '<option value="' + idx + '"' + (idx === (i === 0 ? 0 : Math.min(1, units.length - 1)) ? " selected" : "") + '>' + u.label + '</option>').join("");
  });
  [document.getElementById("corrX"), document.getElementById("corrY")].forEach((sel, i) => {
    sel.innerHTML = CORR_VARS.map((v, idx) => '<option value="' + v.key + '"' + (idx === (i === 0 ? 0 : 1) ? " selected" : "") + '>' + v.label + '</option>').join("");
  });
}

function renderDescriptiveChart() {
  const type = document.getElementById("descField").value;
  const chartType = document.getElementById("descChartType").value;
  const values = DatasetManager.numericValues(type || undefined);
  const svg = document.getElementById("descChart");
  if (chartType === "bar") {
    const labels = values.map((v, i) => "r" + (i + 1));
    if (values.length > 30) { Charts.histogram(svg, values, 8); }
    else Charts.barChart(svg, labels, values);
  } else if (chartType === "histogram") Charts.histogram(svg, values, 8);
  else Charts.boxStyle(svg, values);

  const stats = StatsEngine.describe(values);
  document.getElementById("descStats").innerHTML = ["n", "mean", "median", "sd", "min", "max", "range"].map(k =>
    '<div class="stat-box"><div class="stat-val">' + stats[k] + '</div><div class="stat-lab">' + k.toUpperCase() + '</div></div>'
  ).join("");

  const result = CalcEngine.computeIndicators(App.state.space, App.state.weights);
  const radarKeys = ["accessibility", "walkability", "visibility", "safety", "social", "comfort", "privacy", "sociability", "activityDiversity"];
  Charts.radarChart(document.getElementById("radarChart"), radarKeys.map(k => CalcEngine.indicatorLabel(k).replace(" Index", "").replace(" Potential", "").replace(" Score", "")), radarKeys.map(k => result.indicators[k].score));
  App.state.workflow.analyzed = true; markDirty();
}

function renderScenarioComparison() {
  const units = getSampleUnits();
  const a = units[Number(document.getElementById("scenarioA").value)];
  const b = units[Number(document.getElementById("scenarioB").value)];
  if (!a || !b) return;
  const ra = CalcEngine.computeIndicators(a.space, App.state.weights), rb = CalcEngine.computeIndicators(b.space, App.state.weights);
  const keys = ["accessibility", "walkability", "visibility", "safety", "social", "comfort", "privacy", "sociability", "activityDiversity"];
  let html = "<table><thead><tr><th>Indicator</th><th>" + a.label + "</th><th>" + b.label + "</th><th>Difference</th><th>% Change</th></tr></thead><tbody>";
  keys.concat(["composite"]).forEach(k => {
    const va = k === "composite" ? ra.composite.score : ra.indicators[k].score;
    const vb = k === "composite" ? rb.composite.score : rb.indicators[k].score;
    const diff = Utils.round1(vb - va);
    const pct = va !== 0 ? Utils.round1((diff / va) * 100) : null;
    html += "<tr><td>" + (k === "composite" ? "Public Space Quality Score" : CalcEngine.indicatorLabel(k)) + "</td><td>" + Utils.round1(va) + "</td><td>" + Utils.round1(vb) + "</td><td>" + (diff >= 0 ? "+" : "") + diff + "</td><td>" + (pct === null ? "n/a" : (pct >= 0 ? "+" : "") + pct + "%") + "</td></tr>";
  });
  html += "</tbody></table>";
  html += '<p class="hint">Model indicator changed by the amounts shown above between ' + a.label + ' and ' + b.label + '. This describes change in the model-based indicator, not a direct empirical claim about the named construct.</p>';
  document.getElementById("scenarioCompareResult").innerHTML = html;
  window.__lastComparison = { a, b, ra, rb, keys };
  renderComparisonMatrix();
}

function renderComparisonMatrix() {
  const el = document.getElementById("comparisonMatrixTable");
  const cmp = window.__lastComparison;
  if (!cmp) { el.innerHTML = '<p class="hint">Run a Scenario Comparison first (Analysis → Scenario Comparison).</p>'; return; }
  let html = "<table><thead><tr><th>Variable / Indicator</th><th>" + cmp.a.label + "</th><th>" + cmp.b.label + "</th><th>Difference</th><th>% Difference</th><th>Interpretation</th></tr></thead><tbody>";
  cmp.keys.forEach(k => {
    const va = cmp.ra.indicators[k].score, vb = cmp.rb.indicators[k].score;
    const diff = Utils.round1(vb - va);
    const pct = va !== 0 ? Utils.round1((diff / va) * 100) : null;
    html += "<tr><td>" + CalcEngine.indicatorLabel(k) + "</td><td>" + Utils.round1(va) + "</td><td>" + Utils.round1(vb) + "</td><td>" + diff + "</td><td>" + (pct === null ? "n/a" : pct + "%") + "</td><td>" + (Math.abs(diff) < 3 ? "Negligible model difference" : diff > 0 ? "Higher under " + cmp.b.label : "Higher under " + cmp.a.label) + "</td></tr>";
  });
  html += "</tbody></table>";
  el.innerHTML = html;
}

function runCorrelation() {
  const xKey = document.getElementById("corrX").value, yKey = document.getElementById("corrY").value;
  const xDef = CORR_VARS.find(v => v.key === xKey), yDef = CORR_VARS.find(v => v.key === yKey);
  const units = getSampleUnits();
  const points = units.map(u => {
    const r = CalcEngine.computeIndicators(u.space, App.state.weights);
    return { x: xDef.get(u.space, r), y: yDef.get(u.space, r), label: u.label };
  });
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const r = StatsEngine.pearson(xs, ys);
  const el = document.getElementById("corrResult");
  if (points.length < 3) {
    el.innerHTML = '<p class="hint">Only ' + points.length + ' sample unit(s) available (baseline/treatment/conditions/snapshots). Add more conditions or snapshots for a meaningful correlation (n ≥ 3 recommended).</p>';
  } else {
    el.innerHTML = '<div class="stats-grid"><div class="stat-box"><div class="stat-val">' + (r === null ? "n/a" : Utils.round1(r)) + '</div><div class="stat-lab">Pearson r</div></div>' +
      '<div class="stat-box"><div class="stat-val">' + points.length + '</div><div class="stat-lab">Sample size (n)</div></div></div>' +
      '<div class="causality-warning" style="margin-top:10px;">CAUTION: Correlation in this simulated/model-generated data does not establish real-world causation.</div>';
  }
  Charts.scatterChart(document.getElementById("scatterChart"), points, { xLabel: xDef.label, yLabel: yDef.label });
}

function initAnalysisUI() {
  populateAnalysisSelectors();
  document.getElementById("descField").addEventListener("change", renderDescriptiveChart);
  document.getElementById("descChartType").addEventListener("change", renderDescriptiveChart);
  document.getElementById("btnCompareScenarios").addEventListener("click", renderScenarioComparison);
  document.getElementById("btnRunCorrelation").addEventListener("click", runCorrelation);
  renderDescriptiveChart();
}
UI.renderAnalysisPanel = function () { populateAnalysisSelectors(); renderDescriptiveChart(); };

/* ===================== UI: DATASET PANEL ===================== */
UI.renderDatasetPanel = function () {
  const search = document.getElementById("datasetSearch").value;
  const type = document.getElementById("datasetFilterType").value;
  const sort = document.getElementById("datasetSort").value;
  const rows = DatasetManager.query({ search, type, sort });
  const table = document.getElementById("datasetTable");
  const cols = ["condition", "independent_variable", "independent_value", "dependent_variable", "dependent_value", "observation_type", "participant_id", "trial", "timestamp", "notes"];
  let html = "<thead><tr>" + cols.map(c => "<th>" + c.replace(/_/g, " ") + "</th>").join("") + "<th>Actions</th></tr></thead><tbody>";
  if (!rows.length) html += '<tr><td colspan="' + (cols.length + 1) + '" class="hint">No dataset rows yet.</td></tr>';
  rows.forEach(r => {
    html += "<tr data-row-id=\"" + r.id + "\">" + cols.map(c => "<td>" + (c === "timestamp" ? Utils.fmtTime(r[c]) : (r[c] !== undefined ? r[c] : "")) + "</td>").join("") +
      '<td><button class="btn btn-xs" data-edit-row="' + r.id + '">Edit</button> <button class="btn btn-xs" data-dup-row="' + r.id + '">Dup</button> <button class="btn btn-xs btn-danger-outline" data-del-row="' + r.id + '">Del</button></td></tr>';
  });
  html += "</tbody>";
  table.innerHTML = html;

  table.querySelectorAll("[data-del-row]").forEach(b => b.addEventListener("click", () => { if (confirm("Delete this row?")) { DatasetManager.deleteRow(b.dataset.delRow); UI.renderDatasetPanel(); UI.updateMiniDashboard(); } }));
  table.querySelectorAll("[data-dup-row]").forEach(b => b.addEventListener("click", () => { DatasetManager.duplicateRow(b.dataset.dupRow); UI.renderDatasetPanel(); UI.updateMiniDashboard(); }));
  table.querySelectorAll("[data-edit-row]").forEach(b => b.addEventListener("click", () => editDatasetRow(b.dataset.editRow)));

  const logTable = document.getElementById("logTable");
  const logRows = App.state.log.slice().reverse().slice(0, 100);
  logTable.querySelector("tbody").innerHTML = logRows.map(l =>
    "<tr><td>" + Utils.fmtTime(l.timestamp) + "</td><td>" + l.action + "</td><td>" + l.variable + "</td><td>" + l.oldValue + "</td><td>" + l.newValue + "</td><td>" + l.experimentId + "</td></tr>"
  ).join("") || '<tr><td colspan="6" class="hint">No log entries yet.</td></tr>';
};

function editDatasetRow(id) {
  const row = App.state.dataset.find(r => r.id === id);
  if (!row) return;
  const fields = ["condition", "independent_variable", "independent_value", "dependent_variable", "dependent_value", "notes"];
  const updates = {};
  for (const f of fields) {
    const v = prompt("Edit " + f.replace(/_/g, " ") + ":", row[f] !== undefined ? row[f] : "");
    if (v === null) return;
    updates[f] = v;
  }
  DatasetManager.updateRow(id, updates);
  UI.renderDatasetPanel();
}

function initDatasetUI() {
  document.getElementById("datasetSearch").addEventListener("input", UI.renderDatasetPanel);
  document.getElementById("datasetFilterType").addEventListener("change", UI.renderDatasetPanel);
  document.getElementById("datasetSort").addEventListener("change", UI.renderDatasetPanel);
  document.getElementById("btnAddDatasetRow").addEventListener("click", () => {
    DatasetManager.addRow({ condition: "manual", independent_variable: "", independent_value: "", dependent_variable: "", dependent_value: "", observation_type: "observation", notes: "Manually added row" });
    UI.renderDatasetPanel();
  });
  document.getElementById("btnClearDataset").addEventListener("click", () => {
    if (!confirm("Clear the ENTIRE dataset? This cannot be undone.")) return;
    DatasetManager.clearAll(); UI.renderDatasetPanel(); UI.updateMiniDashboard();
  });
  document.getElementById("btnExportCSV").addEventListener("click", () => { DatasetManager.exportCSV(); UI.updateWorkflowBar(); Utils.toast("CSV exported.", "success"); });
  document.getElementById("btnExportJSON").addEventListener("click", () => { DatasetManager.exportJSON(); UI.updateWorkflowBar(); Utils.toast("JSON exported.", "success"); });
  document.getElementById("btnExportLog").addEventListener("click", () => { LogManager.exportCSV(); Utils.toast("Experiment log exported.", "success"); });

  document.getElementById("btnNewStudy").addEventListener("click", () => {
    if (!confirm("Start a new study? Current unsaved work will be replaced (dataset and log are kept).")) return;
    const keepDataset = App.state.dataset, keepLog = App.state.log;
    App.state = defaultState();
    App.state.dataset = keepDataset; App.state.log = keepLog;
    fullRerender();
  });
  document.getElementById("btnExportProject").addEventListener("click", () => {
    const p = Utils.deepClone(App.state); delete p.spaceHistory; delete p.selection;
    Utils.download("psrl_project_" + Date.now() + ".json", JSON.stringify(p, null, 2), "application/json");
    Utils.toast("Project exported.", "success");
  });
  document.getElementById("btnImportProject").addEventListener("click", () => document.getElementById("importFileInput").click());
  document.getElementById("importFileInput").addEventListener("change", (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object" || !parsed.study || !parsed.space) throw new Error("Invalid project file structure.");
        App.state = Object.assign(defaultState(), parsed);
        App.state.spaceHistory = { stack: [], redo: [] };
        App.state.selection = null;
        fullRerender();
        Utils.toast("Project imported successfully.", "success");
      } catch (err) {
        Utils.toast("Import failed: invalid or corrupt project file.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });
  document.getElementById("btnResetProject").addEventListener("click", () => {
    if (!confirm("Reset the ENTIRE project (study, space, experiments, dataset, everything)? This cannot be undone.")) return;
    Store.clear();
    App.state = defaultState();
    fullRerender();
    Utils.toast("Project reset.", "success");
  });

  UI.renderDatasetPanel();
}

/* ===================== UI: REPORT PANEL ===================== */
function renderReproPanel() {
  const rp = ReportGenerator.reproManifest();
  document.getElementById("reproPanel").innerHTML =
    '<table><tbody>' +
    '<tr><td>Study ID</td><td>' + rp.studyId + '</td></tr>' +
    '<tr><td>Experiment ID</td><td>' + rp.experimentId + '</td></tr>' +
    '<tr><td>Date</td><td>' + Utils.fmtTime(rp.date) + '</td></tr>' +
    '<tr><td>Model Version</td><td>' + rp.modelVersion + '</td></tr>' +
    '<tr><td>Trials</td><td>' + (rp.trials ?? "n/a") + '</td></tr>' +
    '<tr><td>Replication Count</td><td>' + (rp.replication ?? "n/a") + '</td></tr>' +
    '<tr><td>Randomization Seed</td><td>' + (rp.seed ?? "n/a") + '</td></tr>' +
    '<tr><td>Stochastic Simulation</td><td>' + (rp.stochastic ? "Enabled (" + rp.stochasticLevel + "%)" : "Disabled") + '</td></tr>' +
    '<tr><td>Dataset Size</td><td>' + rp.datasetSize + ' rows</td></tr>' +
    '<tr><td>Configuration Hash</td><td><code>' + rp.configHash + '</code></td></tr>' +
    '</tbody></table>' +
    '<h3 style="margin-top:14px;">Model Assumptions</h3><ul>' + rp.assumptions.map(a => "<li>" + a + "</li>").join("") + '</ul>';
}

function renderFinalDashboard() {
  const result = CalcEngine.computeIndicators(App.state.space, App.state.weights);
  const exp = ExperimentEngine.getActive();
  const qc = QualityCheck.completeness();
  const keys = ["accessibility", "walkability", "visibility", "safety", "comfort", "sociability", "privacy", "activityDiversity"];
  document.getElementById("finalDashboard").innerHTML =
    '<h3>Research Status</h3>' +
    '<p>Study: <strong>' + (App.state.study.title || "(untitled)") + '</strong> | Experiment: <strong>' + (exp ? exp.id : "none") + '</strong> | Trials: <strong>' + (exp ? exp.trials : 0) + '</strong> | Dataset rows: <strong>' + App.state.dataset.length + '</strong></p>' +
    '<h3 style="margin-top:14px;">Model Indicators</h3>' +
    '<div class="stats-grid">' + keys.map(k => '<div class="stat-box"><div class="stat-val">' + Utils.round1(result.indicators[k].score) + '</div><div class="stat-lab">' + CalcEngine.indicatorLabel(k).replace(" Index", "").replace(" Potential", "") + '</div></div>').join("") + '</div>' +
    '<h3 style="margin-top:14px;">Experiment Result</h3>' +
    (exp && exp.results ? ('<p>Baseline: ' + exp.results.baseline.stats.mean + ' | Treatment: ' + exp.results.treatment.stats.mean + ' | Difference: ' + exp.results.meanDifference + ' | Effect (SMD): ' + (exp.results.smd === null ? "n/a" : exp.results.smd) + '</p>') : '<p class="hint">No controlled experiment run yet.</p>') +
    '<h3 style="margin-top:14px;">Data Quality</h3>' +
    '<p>Observations: ' + App.state.observations.length + ' | Participant responses: ' + App.state.participants.responses.length + ' | Trials logged: ' + App.state.dataset.filter(r => r.observation_type === "simulation").length + ' | Replication: ' + (exp ? exp.replication : "n/a") + '</p>' +
    '<h3 style="margin-top:14px;">Research Readiness</h3>' +
    '<p>Research design completeness: <strong>' + qc + '%</strong> | Dataset: ' + (App.state.dataset.length > 0 ? "✓" : "✗") + ' | Analysis: ' + (App.state.workflow.analyzed ? "✓" : "✗") + ' | Reproducibility manifest: ✓ | Limitations acknowledged: ✓</p>';
}

UI.renderReportStatics = function () { renderReproPanel(); renderFinalDashboard(); };

function initReportUI() {
  document.getElementById("btnGenerateSummary").addEventListener("click", () => {
    document.getElementById("summaryOutput").textContent = ReportGenerator.buildSummary();
    App.state.workflow.report = true; UI.updateWorkflowBar(); markDirty();
  });
  document.getElementById("btnCopySummary").addEventListener("click", () => copyText(document.getElementById("summaryOutput").textContent, "Summary"));
  document.getElementById("btnDownloadSummary").addEventListener("click", () => Utils.download("research_summary.txt", document.getElementById("summaryOutput").textContent || ReportGenerator.buildSummary(), "text/plain"));

  document.getElementById("btnGeneratePaper").addEventListener("click", () => {
    document.getElementById("paperOutput").textContent = ReportGenerator.buildPaper();
    App.state.workflow.report = true; UI.updateWorkflowBar(); markDirty();
  });
  document.getElementById("btnCopyPaper").addEventListener("click", () => copyText(document.getElementById("paperOutput").textContent, "Paper draft"));
  document.getElementById("btnDownloadPaper").addEventListener("click", () => Utils.download("research_paper_draft.txt", document.getElementById("paperOutput").textContent || ReportGenerator.buildPaper(), "text/plain"));

  document.getElementById("btnExportConfig").addEventListener("click", () => {
    const rp = ReportGenerator.reproManifest();
    const config = { reproducibility: rp, study: App.state.study, space: App.state.space, weights: App.state.weights, conditions: App.state.conditions, experiments: App.state.experiments };
    Utils.download("experiment_configuration_" + rp.studyId + ".json", JSON.stringify(config, null, 2), "application/json");
    Utils.toast("Experiment configuration exported.", "success");
  });

  renderReproPanel(); renderFinalDashboard();
}

function copyText(text, label) {
  if (!text) { Utils.toast("Generate the " + label.toLowerCase() + " first.", "error"); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => Utils.toast(label + " copied to clipboard.", "success")).catch(() => Utils.toast("Could not copy automatically — select and copy manually.", "error"));
  } else {
    Utils.toast("Clipboard API unavailable — select and copy manually.", "error");
  }
}

/* ===================== DEMO DATA ===================== */
function loadDemoStudy() {
  App.state.study = {
    title: "Influence of Seating Configuration on Social Interaction Potential in an Urban Public Space",
    question: "How does seating configuration influence model-based social interaction potential?",
    objective: "To explore, using a virtual experimental research instrument, whether seating configuration is associated with changes in a model-based indicator of social interaction potential in an otherwise equivalent public plaza.",
    hypothesis: "Clustered seating will produce greater model-based social interaction potential than dispersed seating under otherwise equivalent spatial conditions.",
    type: "Experimental", iv: "Seating configuration", dv: "Social interaction potential",
    controls: "Space geometry, entrances, vegetation, lighting, pathways",
    context: "Urban public plaza, temperate climate, weekday afternoon scenario (simulated).",
    notes: "DEMO DATA — REPLACE WITH EMPIRICAL DATA."
  };
  fillStudyForm(); UI.renderQualityCheck(); UI.updateWorkflowBar(); markDirty();
}

function loadDemoExperiment() {
  App.state.editingCondition = null;
  const demoBase = Presets.build("open");
  demoBase.objects.seats = [];
  SpaceModel.setObjectCount(demoBase, "seats", 10);
  demoBase.objects.seats.forEach(s => s.type = "individual");
  SpaceHistory.beginEdit(); App.state.space = demoBase; SpaceHistory.commitEdit();
  fillSpaceForm();
  ExperimentEngine.setBaseline();

  ExperimentEngine.duplicateToTreatment();
  const treatSpace = App.state.conditions.treatment.space;
  treatSpace.objects.seats.forEach(s => { s.type = "clustered"; });
  const rng = Utils.mulberry32(4242);
  const clusterCenters = [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 }];
  treatSpace.objects.seats.forEach((s, i) => {
    const c = clusterCenters[i % clusterCenters.length];
    s.x = SpaceModel.clamp01(c.x + (rng() - 0.5) * 0.08);
    s.y = SpaceModel.clamp01(c.y + (rng() - 0.5) * 0.08);
  });
  ExperimentEngine.lockControls(["Space geometry", "Entrances", "Vegetation", "Lighting", "Pathways"]);

  const exp = ExperimentEngine.createOrUpdate({
    id: ExperimentEngine.nextExperimentId(), name: "Seating Configuration → Social Interaction Potential",
    question: App.state.study.question, hypothesis: App.state.study.hypothesis, iv: "Seating configuration",
    dv: "Social interaction potential", controls: "Space geometry, entrances, vegetation, lighting, pathways",
    trials: 5, replication: 3, seed: 12345, notes: "DEMO DATA — REPLACE WITH EMPIRICAL DATA."
  });
  fillExperimentForm(exp);
  const result = ExperimentEngine.runControlled("social");
  renderControlledResults(result);
  renderConditionSummaries();
  renderExperimentList();

  ["A", "B", "C", "D"].forEach((letter, i) => {
    const s = Utils.deepClone(demoBase);
    s.objects.seats.forEach((seat, si) => { seat.type = ["individual", "clustered", "linear", "circular"][i]; });
    if (i === 1) { s.objects.seats.forEach((seat, si) => { const c = clusterCenters[si % clusterCenters.length]; seat.x = SpaceModel.clamp01(c.x); seat.y = SpaceModel.clamp01(c.y); }); }
    if (i === 2) { s.objects.seats.forEach((seat, si) => { seat.x = 0.15 + (si / s.objects.seats.length) * 0.7; seat.y = 0.5; }); }
    if (i === 3) { s.objects.seats.forEach((seat, si) => { const ang = (si / s.objects.seats.length) * Math.PI * 2; seat.x = SpaceModel.clamp01(0.5 + 0.3 * Math.cos(ang)); seat.y = SpaceModel.clamp01(0.5 + 0.3 * Math.sin(ang)); }); }
    App.state.conditions.list.push({ id: Utils.uid("cond"), name: "Condition " + letter + " (" + ["Dispersed", "Clustered", "Linear", "Circular"][i] + ")", space: s, notes: "DEMO DATA — REPLACE WITH EMPIRICAL DATA.", timestamp: Utils.nowISO() });
  });
  renderConditionList();

  ["North seating cluster", "Central plaza", "South edge"].forEach((loc, i) => {
    ObservationManager.add({
      location: loc, condition: i === 0 ? "Treatment (clustered)" : "Baseline (dispersed)",
      pedestrians: 20 + i * 5, seated: 8 + i * 2, standing: 4, walking: 10, groups: 2 + i, solo: 3,
      interactions: 5 + i * 3, duration: 12 + i, activities: "sitting, conversing, walking",
      conflicts: 0, noise: 2, comfort: 4, safety: 4, accessProblems: "", notes: "DEMO DATA — REPLACE WITH EMPIRICAL DATA."
    });
  });
  renderObservationTable();

  const conditions = ["Baseline (dispersed)", "Treatment (clustered)", "Treatment (clustered)"];
  conditions.forEach((cond, i) => {
    const answers = {};
    App.state.participants.questions.forEach(q => { answers[q.id] = Math.min(5, Math.max(1, 3 + (cond.includes("clustered") ? 1 : 0) + (Math.round(Math.random()) - 0))); });
    ParticipantManager.addResponse(ParticipantManager.nextParticipantId(), cond, answers);
  });
  renderLikertForm(); renderResponseSummary();
  document.getElementById("participantId").value = ParticipantManager.nextParticipantId();

  UI.updateMiniDashboard(); UI.renderDatasetPanel(); UI.renderVariablesPanel();
  markDirty();
}

function loadFullDemo() {
  loadDemoStudy();
  loadDemoExperiment();
  App.state.workflow.observations = true;
  App.state.workflow.analyzed = true;
  UI.updateWorkflowBar();
  markDirty();
}

/* ===================== FULL RE-RENDER (after state replace) ===================== */
function fullRerender() {
  fillStudyForm(); UI.renderQualityCheck();
  fillSpaceForm(); Viz.render(); renderPropertiesPanel(); renderSnapshotList();
  UI.renderVariablesPanel();
  fillExperimentForm(ExperimentEngine.getActive());
  renderExperimentList(); renderConditionSummaries(); renderConditionList();
  renderControlledResults(ExperimentEngine.getActive() ? ExperimentEngine.getActive().results : null);
  renderObservationTable(); renderQuestionList(); renderLikertForm();
  document.getElementById("participantId").value = ParticipantManager.nextParticipantId();
  UI.renderDatasetPanel();
  populateAnalysisSelectors(); renderDescriptiveChart();
  UI.renderReportStatics();
  UI.updateMiniDashboard();
}

/* ===================== BOOTSTRAP ===================== */
document.addEventListener("DOMContentLoaded", () => {
  const saved = Store.load();
  const isFirstRun = !saved;
  App.state = Object.assign(defaultState(), saved || {});
  App.state.spaceHistory = { stack: [], redo: [] };
  App.state.selection = null;
  if (!App.state.space || !App.state.space.objects) App.state.space = Presets.build("open");
  if (!App.state.weights || !App.state.weights.indicators) App.state.weights = WeightsManager.defaultWeights();
  if (!App.state.participants || !App.state.participants.questions || !App.state.participants.questions.length) App.state.participants = { questions: defaultQuestions(), responses: (App.state.participants && App.state.participants.responses) || [], nextIndex: (App.state.participants && App.state.participants.nextIndex) || 1 };
  if (!App.state.editingCondition && App.state.editingCondition !== null) App.state.editingCondition = null;

  initCoreUI();
  initResearchQuestionUI();
  initSpaceBuilderUI();
  initVariablesUI();
  initExperimentUI();
  initObservationsUI();
  initAnalysisUI();
  initDatasetUI();
  initReportUI();

  fillStudyForm(); UI.renderQualityCheck();
  fillSpaceForm(); Viz.render(); renderSnapshotList();
  UI.renderVariablesPanel();
  UI.updateMiniDashboard();

  if (isFirstRun) {
    try { loadFullDemo(); Utils.toast("Demo study loaded — DEMO DATA — REPLACE WITH EMPIRICAL DATA.", "success"); }
    catch (err) { console.error("Demo load failed", err); }
  }
  markDirty();
});
