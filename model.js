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
      if (missing.length) { v *= 0.5; unsupported.push({ id: b.id, missing: missing }); }
      str[b.id] = v;
    });
    // carrying capacity
    var load = 0, cap = 0, baseLoad = 0;
    D.BLOCKS.forEach(function (b) { if (b.on) baseLoad += b.wt; });
    inB.forEach(function (b) { load += b.wt; cap += b.cap; });
    var budget = baseLoad + D.SLACK + cap, dil = load <= budget ? 1 : budget / load;
    // readouts
    var coal = D.AUD.map(function () { return 0; }), prize = 0, gate = 0, spd = 0, trust = 0, goal = 0, one = 0;
    inB.forEach(function (b) {
      var k = str[b.id] * dil;
      b.a.forEach(function (v, i) { coal[i] += v >= 0 ? v * k : v; });
      prize += b.want * k; gate += b.gate * k; trust += b.trust * k;
      spd += b.spd; goal += b.goal; one += b.one;
    });
    var hidden = 0; inB.forEach(function (b) { hidden += 1 - str[b.id]; });
    return { on: on, ids: inB.map(function (b) { return b.id; }), str: str, by: by, unsupported: unsupported, load: load, budget: budget, dil: dil,
      coal: coal, prize: prize, gate: gate, spd: spd, trust: trust, goal: goal, one: one, hidden: hidden };
  }
  function evaluate(D, ids) {
    var base = raw(D, defaults(D)), r = raw(D, ids);
    r.base = base;
    r.ratio = r.coal.map(function (v, i) { return base.coal[i] ? v / base.coal[i] : 1; });
    r.prizeR = r.prize / base.prize; r.gateR = r.gate / base.gate; r.lev = r.prizeR * r.gateR;
    r.trustR = r.trust / base.trust; r.spdD = r.spd - base.spd;
    r.instability = clamp((r.hidden / 6) + (1 - r.dil) * 1.5, 0, 1);
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
  var AUDIX = { dem: 0, gop: 1, omb: 2, state: 3, approp: 4, econ: 5, partner: 6, biz: 7, power: 8 };
  function drop(r) { return clamp((1 - r) / 0.5, 0, 1); }
  var THR = [0.15, 0.35, 0.6]; // cautious, balanced, bold
  // tol = {funding, leverage, evidence, speed}, each 0..2. Tolerance changes what is a headline, never the numbers.
  function risks(D, r, tol) {
    var items = [], gains = [], pct = function (x) { return Math.round(Math.abs(1 - x) * 100) + "%"; };
    function risk(dial, sev, text) { if (sev > 0.02) items.push({ dial: dial, sev: sev, text: text, headline: sev > THR[tol[dial]] }); }
    function aud(dial, id, label) {
      var x = r.ratio[AUDIX[id]];
      if (x <= 0) risk(dial, 1, "may lose " + label + " (support gone; on balance they would now oppose)");
      else if (x < 1) risk(dial, drop(x), "may lose " + label + " (support down " + pct(x) + ")");
      else if (x > 1.08) gains.push(label + " (up " + pct(x) + ")");
    }
    aud("funding", "approp", "appropriators"); aud("funding", "omb", "OMB and the White House");
    aud("funding", "dem", "Democrats and NGO allies"); aud("funding", "gop", "Republicans and conservatives");
    aud("leverage", "partner", "partner governments"); aud("leverage", "power", "in-country power brokers");
    aud("evidence", "econ", "economists and evaluators");
    ["state", "biz"].forEach(function (id) { var x = r.ratio[AUDIX[id]], l = id === "state" ? "State leadership" : "US business";
      if (x > 1.08) gains.push(l + " (up " + pct(x) + ")"); else if (x < 1) risk("funding", drop(x) * 0.6, "may lose " + l + " (support down " + pct(x) + ")"); });
    if (r.gateR < 1) risk("leverage", drop(r.gateR), "a weaker gate: less the US can credibly condition (down " + pct(r.gateR) + ")");
    else if (r.gateR > 1.08) gains.push("a firmer gate (up " + pct(r.gateR) + ")");
    if (r.prizeR < 1) risk("leverage", drop(r.prizeR), "a smaller prize: less that partners want (down " + pct(r.prizeR) + ")");
    else if (r.prizeR > 1.08) gains.push("a bigger prize for partners (up " + pct(r.prizeR) + ")");
    // Only strain on blocks still standing shows here. A pulled block is silent until a stress test.
    var ev = ["diag", "err", "eval"].filter(function (id) { return r.on[id]; }).map(function (id) { return r.str[id]; });
    var evm = ev.length ? ev.reduce(function (a, b) { return a + b; }, 0) / ev.length : 1;
    if (evm < 1) risk("evidence", clamp((1 - evm) / 0.6, 0, 1), "weaker evidence discipline: the evidence blocks still standing carry " + Math.round(evm * 100) + "% of their weight");
    if (r.spdD < 0) risk("speed", clamp(-r.spdD / 6, 0, 1), "slower compacts (" + (-r.spdD) + " more steps of drag)");
    else if (r.spdD > 0) gains.push("faster compacts");
    var avg = Math.round((tol.funding + tol.leverage + tol.evidence + tol.speed) / 4);
    if (r.dil < 1) { var s = clamp((1 - r.dil) / 0.4, 0, 1);
      items.push({ dial: "capacity", sev: s, headline: s > THR[avg], text: "an overloaded instrument: every block delivers about " + Math.round(r.dil * 100) + "% of what it could" }); }
    items.sort(function (a, b) { return b.sev - a.sev; });
    return { headlines: items.filter(function (i) { return i.headline; }), footnotes: items.filter(function (i) { return !i.headline; }), gains: gains };
  }
  function stress(D, r, shock) {
    var M = byId(D), cov = 0, rows = shock.carriers.map(function (id) {
      var v = r.on[id] ? r.str[id] : 0; cov += v;
      return { id: id, n: M[id].n, v: v, state: !r.on[id] ? "missing" : v < 0.67 ? "strained" : "holding" };
    });
    cov /= shock.carriers.length;
    var aud = shock.auds.map(function (a) { return { id: a, r: r.ratio[AUDIX[a]] }; });
    var weakAud = aud.filter(function (a) { return a.r < 0.8; });
    var score = cov * r.dil - weakAud.length * 0.1;
    return { cov: cov, score: score, rows: rows, weakAud: weakAud, verdict: score >= 0.8 ? "holds" : score >= 0.55 ? "is strained" : "gives way" };
  }
  var MOD = { evaluate: evaluate, risks: risks, stress: stress, defaults: defaults, preset: preset, byId: byId, AUDIX: AUDIX };
  if (typeof module !== "undefined" && module.exports) module.exports = MOD; else root.MODEL = MOD;
})(this);
