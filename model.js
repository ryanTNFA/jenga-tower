/* Pure scoring for the MCC tower. No DOM. */
(function (root) {
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function byId(D) { var m = {}; D.BLOCKS.forEach(function (b) { m[b.id] = b; }); return m; }
  function defaults(D) { return D.BLOCKS.filter(function (b) { return b.on; }).map(function (b) { return b.id; }); }
  function preset(D, p) {
    var set = defaults(D).filter(function (id) { return p.drop.indexOf(id) < 0; });
    var add = p.add === "ALL" ? D.BLOCKS.filter(function (b) { return !b.on && (p.skip || []).indexOf(b.id) < 0; }).map(function (b) { return b.id; }) : p.add;
    return set.concat(add);
  }
  // Blocks in the tower as built that list this one in `needs`.
  function dependents(D, id) { return D.BLOCKS.filter(function (b) { return b.on && b.needs.indexOf(id) >= 0; }); }
  // How load-bearing a block is: half a point for being part of the tower, a point for each block that
  // rests on it, and a point for each stress test that counts on it. Derived from the data, not scored.
  function bearing(D, id) {
    var cars = D.SHOCKS.filter(function (s) { return s.carriers.indexOf(id) >= 0; }).length;
    return 0.5 + dependents(D, id).length + cars;
  }
  function raw(D, ids) {
    var M = byId(D), on = {}; ids.forEach(function (i) { if (M[i]) on[i] = true; });
    var inB = D.BLOCKS.filter(function (b) { return on[b.id]; });
    // strain and dependencies
    var strain = {}, by = {};
    inB.forEach(function (b) { b.strains.forEach(function (s) {
      if (!on[s.t]) return; strain[s.t] = (strain[s.t] || 0) + s.amt; (by[s.t] = by[s.t] || []).push({ from: b.id, amt: s.amt, why: s.why });
    }); });
    var str = {}, unsupported = [];
    inB.forEach(function (b) {
      var v = clamp(1 - (strain[b.id] || 0) / 3, 0, 1);
      var missing = b.needs.filter(function (n) { return !on[n]; });
      if (missing.length) { v *= Math.pow(0.5, missing.length); unsupported.push({ id: b.id, missing: missing }); }
      str[b.id] = v;
    });
    // carrying capacity
    var load = 0, cap = 0, baseLoad = 0;
    D.BLOCKS.forEach(function (b) { if (b.on) baseLoad += b.wt; });
    inB.forEach(function (b) { load += b.wt; cap += b.cap; });
    var budget = baseLoad + D.SLACK + cap, dil = load <= budget ? 1 : budget / load;
    // readouts
    var coal = D.AUD.map(function () { return 0; }), prize = 0, gate = 0, rig = 0, spd = 0, trust = 0, goal = 0, one = 0;
    inB.forEach(function (b) {
      var k = str[b.id] * dil;
      b.a.forEach(function (v, i) { coal[i] += v >= 0 ? v * k : v; });
      rig += b.rig >= 0 ? b.rig * k : b.rig;
      prize += b.want * k; gate += b.gate * k; trust += b.trust * k;
      spd += b.spd; goal += b.goal; one += b.one;
    });
    var hidden = 0; inB.forEach(function (b) { hidden += 1 - str[b.id]; });
    // blocks from the tower as built that have been pulled, and how much each was holding up
    var pulled = D.BLOCKS.filter(function (b) { return b.on && !on[b.id]; }).map(function (b) { return b.id; });
    var gap = 0; pulled.forEach(function (id) { gap += bearing(D, id); });
    return { on: on, ids: inB.map(function (b) { return b.id; }), str: str, by: by, unsupported: unsupported, load: load, budget: budget, dil: dil,
      coal: coal, prize: prize, gate: gate, rig: rig, spd: spd, trust: trust, goal: goal, one: one, hidden: hidden, pulled: pulled, gap: gap };
  }
  function evaluate(D, ids) {
    var base = raw(D, defaults(D)), r = raw(D, ids);
    r.base = base;
    r.ratio = r.coal.map(function (v, i) { return base.coal[i] ? v / base.coal[i] : 1; });
    r.prizeR = r.prize / base.prize; r.gateR = r.gate / base.gate; r.lev = r.prizeR * r.gateR;
    r.rigR = r.rig / base.rig;
    r.trustR = r.trust / base.trust; r.spdD = r.spd - base.spd;
    // Wobble: blocks that are weakened, plus the gap left by blocks pulled out (scaled by how much each held up), plus overload.
    r.instability = clamp(r.hidden / 8 + r.gap / 10 + (1 - r.dil) * 1.5, 0, 1);
    r.profile = profile(r);
    return r;
  }
  // Deal profile, after Devermont's four types. The mapping to blocks is ours.
  function profile(r) {
    if (r.one >= 5) return { id: "corrosive", why: "terms tilt one way: the US takes more than the partner gets" };
    if (r.goal >= 4) return { id: "counterproductive", why: "conditions keep being added that have little to do with the investment" };
    if (r.trustR < 0.65) return { id: "counterproductive", why: "the delivery record that makes a deal believable has thinned" };
    if (r.prizeR < 0.7) return { id: "contained", why: "the offer is narrow, so little rides on it either way" };
    return { id: "constructive", why: "a wanted prize, a visible record of delivery, and terms tied to the investment" };
  }
  var AUDIX = { dem: 0, gop: 1, omb: 2, state: 3, approp: 4, partner: 5, biz: 6, power: 7 };
  // Plain words for a ratio against the tower as built. Used everywhere a number would otherwise show.
  function change(x, aud) {
    if (x >= 1.25) return { dir: "up", word: "up a lot" };
    if (x >= 1.08) return { dir: "up", word: "up" };
    if (x > 0.92) return { dir: "same", word: "about the same" };
    if (x >= 0.75) return { dir: "down", word: "down a little" };
    if (x >= 0.4) return { dir: "down", word: "down" };
    if (x > 0) return { dir: "down", word: "down a lot" };
    return { dir: "down", word: aud ? "turned against it" : "gone" };
  }
  // Name for an audience id, or for the rigor readout.
  function who(D, id) { return id === "rigor" ? "economic rigor" : D.AUD[AUDIX[id]].n; }
  function drop(r) { return clamp((1 - r) / 0.5, 0, 1); }
  var THR = [0.15, 0.35, 0.6]; // cautious, balanced, bold
  // tol = {funding, leverage, evidence, speed}, each 0..2. Tolerance changes what is a headline, never the numbers.
  function risks(D, r, tol) {
    var items = [], gains = [];
    function risk(dial, sev, text) { if (sev > 0.02) items.push({ dial: dial, sev: sev, text: text, headline: sev > THR[tol[dial]] }); }
    function down(x) { return x > 0.92 ? "down a little" : x <= 0 ? "down a lot" : change(x).word; }
    function aud(dial, id, label) {
      var x = r.ratio[AUDIX[id]];
      if (x <= 0) risk(dial, 1, "may lose " + label + " (support gone; on balance they would now oppose)");
      else if (x < 1) risk(dial, drop(x), "may lose " + label + " (support " + down(x) + ")");
      else if (x > 1.08) gains.push(label + " (" + change(x).word + ")");
    }
    aud("funding", "approp", "appropriators"); aud("funding", "omb", "OMB and the White House");
    aud("funding", "dem", "Democrats and NGO allies"); aud("funding", "gop", "Republicans and conservatives");
    aud("leverage", "partner", "partner governments"); aud("leverage", "power", "in-country power brokers");
    ["state", "biz"].forEach(function (id) { var x = r.ratio[AUDIX[id]], l = id === "state" ? "State leadership" : "US business";
      if (x > 1.08) gains.push(l + " (" + change(x).word + ")"); else if (x < 1) risk("funding", drop(x) * 0.6, "may lose " + l + " (support " + down(x) + ")"); });
    if (r.gateR < 1) risk("leverage", drop(r.gateR), "a weaker gate: less the US can credibly condition (" + down(r.gateR) + ")");
    else if (r.gateR > 1.08) gains.push("a firmer gate (" + change(r.gateR).word + ")");
    if (r.prizeR < 1) risk("leverage", drop(r.prizeR), "a smaller prize: less that partners want (" + down(r.prizeR) + ")");
    else if (r.prizeR > 1.08) gains.push("a bigger prize for partners (" + change(r.prizeR).word + ")");
    // Rigor is spent, not lost by a group: the tower can show less that its money does what it says.
    if (r.rigR < 1) risk("evidence", drop(r.rigR), "less economic rigor: harder to show the money works (" + down(r.rigR) + ")");
    else if (r.rigR > 1.08) gains.push("more economic rigor (" + change(r.rigR).word + ")");
    if (r.spdD < 0) risk("speed", clamp(-r.spdD / 6, 0, 1), "slower compacts (" + (-r.spdD) + " more steps of drag)");
    else if (r.spdD > 0) gains.push("faster compacts");
    var avg = Math.round((tol.funding + tol.leverage + tol.evidence + tol.speed) / 4);
    if (r.dil < 1) { var s = clamp((1 - r.dil) / 0.4, 0, 1);
      items.push({ dial: "capacity", sev: s, headline: s > THR[avg], text: "an overloaded instrument: every block does less of its job" }); }
    items.sort(function (a, b) { return b.sev - a.sev; });
    return { headlines: items.filter(function (i) { return i.headline; }), footnotes: items.filter(function (i) { return !i.headline; }), gains: gains };
  }
  function stress(D, r, shock) {
    var M = byId(D), cov = 0, rows = shock.carriers.map(function (id) {
      var v = r.on[id] ? r.str[id] : 0; cov += v;
      return { id: id, n: M[id].n, v: v, state: !r.on[id] ? "missing" : v < 0.67 ? "strained" : "holding" };
    });
    cov /= shock.carriers.length;
    var aud = shock.auds.map(function (a) { return { id: a, r: a === "rigor" ? r.rigR : r.ratio[AUDIX[a]] }; });
    var weakAud = aud.filter(function (a) { return a.r < 0.8; });
    var score = cov * r.dil - weakAud.length * 0.1;
    return { cov: cov, score: score, rows: rows, weakAud: weakAud, verdict: score >= 0.8 ? "holds" : score >= 0.55 ? "is strained" : "gives way" };
  }
  function list(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  // What was spent, in the things an MCC runs on. Economic rigor is one of them; it is not a group of people.
  function costs(r) {
    var A = AUDIX;
    return [
      { k: "economic rigor", x: r.rigR },
      { k: "bipartisan support", x: Math.min(r.ratio[A.dem], r.ratio[A.gop]) },
      { k: "budget support", x: Math.min(r.ratio[A.approp], r.ratio[A.omb]) },
      { k: "leverage", x: r.lev },
      { k: "partner buy-in", x: Math.min(r.ratio[A.partner], r.ratio[A.power]) }
    ].filter(function (c) { return c.x < 0.92; }).sort(function (a, b) { return a.x - b.x; });
  }
  // A plain name for what you built: who it now serves and what paid for it.
  function verdict(D, r) {
    var def = defaults(D), same = def.length === r.ids.length && def.every(function (i) { return r.on[i]; });
    if (same) return { title: "MCC as built", line: "Fifteen blocks, each with someone behind it." };
    var hi = 0; r.ratio.forEach(function (x, i) { if (x > r.ratio[hi]) hi = i; });
    var up = r.ratio[hi] > 1.08, H = D.AUD[hi].s, C = costs(r), paid = C.map(function (c) { return c.k; }), top = paid.slice(0, 2);
    if (r.dil < 0.7) return { title: "An everything bagel", line: "It tries to do all of it, so none of it lands well." + (paid.length ? " Costs: " + list(top) + "." : "") };
    if (up && C.length) return { title: "An MCC for " + H + ", paid for in " + paid[0], line: "Gains: " + H + ". Costs: " + list(top) + "." };
    if (r.dil < 0.9) return { title: "A crowded MCC", line: "More asks than the agency can carry, so every block does less of its job." + (paid.length ? " Costs: " + list(top) + "." : "") };
    if (up) return { title: "More for " + H + ", and no bill yet", line: "Nothing has dropped much today. Run the stress tests before you trust that." };
    if (C.length) return { title: "A smaller MCC", line: "Costs: " + list(top) + ". No group gains by a clear margin." };
    if (r.rigR > 1.08) return { title: "A more rigorous MCC", line: "More economic rigor, and nothing has dropped much today. Run the stress tests before you trust that." };
    return { title: "MCC, lightly edited", line: "Nothing moved much today. Run the stress tests before you trust that." };
  }
  function stressAll(D, r) { return D.SHOCKS.map(function (s) { var x = stress(D, r, s); x.shock = s; return x; }); }
  function challenges(D, r, tol) {
    var def = defaults(D), pulled = def.filter(function (i) { return !r.on[i]; }).length, added = r.ids.length - (def.length - pulled);
    var all = stressAll(D, r), holds = all.filter(function (x) { return x.verdict === "holds"; }).length, k = risks(D, r, tol);
    var changed = pulled + added > 0;
    return { quiet: pulled === 1 && added === 0 && k.headlines.length === 0 && holds < all.length,
      state: r.ratio[AUDIX.state] >= 1.2 && r.rigR >= 0.9,
      lunch: added >= 3 && holds === all.length,
      both: changed && r.ratio[AUDIX.dem] > 1.005 && r.ratio[AUDIX.gop] > 1.005,
      trim: pulled >= 2 && holds === all.length };
  }
  var MOD = { verdict: verdict, costs: costs, stressAll: stressAll, challenges: challenges, evaluate: evaluate, risks: risks, stress: stress,
    defaults: defaults, preset: preset, byId: byId, AUDIX: AUDIX, change: change, who: who, bearing: bearing, dependents: dependents };
  if (typeof module !== "undefined" && module.exports) module.exports = MOD; else root.MODEL = MOD;
})(this);
