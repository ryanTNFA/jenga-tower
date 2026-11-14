const D=require('./data.js'),M=require('./model.js'),assert=require('assert');
const bal={funding:1,leverage:1,evidence:1,speed:1};
const def=M.defaults(D), r0=M.evaluate(D,def), ids=new Set(D.BLOCKS.map(b=>b.id));
const wob=ids=>M.evaluate(D,ids).instability;

// --- data is well formed ---
D.BLOCKS.forEach(b=>{assert.equal(b.a.length,D.AUD.length,b.id);assert(typeof b.rig==='number',b.id+' rig');
  b.needs.forEach(n=>{assert(ids.has(n),b.id+' needs '+n);assert(b.nwhy[n],b.id+' needs a reason for '+n);});
  b.strains.forEach(s=>assert(ids.has(s.t),b.id+'>'+s.t));});
D.PRESETS.forEach(p=>{if(p.add!=='ALL')p.add.concat(p.drop).forEach(i=>assert(ids.has(i),i))});
D.SHOCKS.forEach(s=>s.carriers.forEach(i=>assert(ids.has(i))));
D.SHOCKS.forEach(s=>s.auds.forEach(a=>assert(a==='rigor'||a in M.AUDIX,a)));
// no dependency cycles
(function(){const seen={};function walk(id,path){assert(!path.includes(id),'cycle '+path.concat(id).join('>'));if(seen[id])return;D.BLOCKS.find(b=>b.id===id).needs.forEach(n=>walk(n,path.concat(id)));seen[id]=1;}D.BLOCKS.forEach(b=>walk(b.id,[]));})();

// --- economic rigor is a property of the tower, not a group that can be lost ---
assert(!D.AUD.some(a=>/econom/i.test(a.n)),'economists are not an audience');
assert(!('econ' in M.AUDIX));

// --- the tower as built is steady and holds ---
let k=M.risks(D,r0,bal);assert(k.headlines.length===0&&k.footnotes.length===0);
assert.equal(r0.instability,0);assert.equal(r0.rigR,1);
D.SHOCKS.forEach(s=>assert.equal(M.stress(D,r0,s).verdict,'holds',s.id));

// --- pulling blocks adds wobble, scaled by how much each held up ---
assert(wob(def.filter(i=>i!=='err'))>=0.35,'pulling the returns hurdle should wobble');
assert(wob(def.filter(i=>i!=='err'))>wob(def.filter(i=>i!=='lean')),'ERR matters more than lean staff');
assert(wob(def.filter(i=>i!=='lean'))>wob(def.filter(i=>i!=='reg')),'lean staff matters more than regional compacts');
// each named base block has something resting on it that visibly weakens when it is pulled
['diag','err','own','clock','eval','fid','tranche'].forEach(id=>{
  assert(M.dependents(D,id).length>0,id+' has dependents');
  const r=M.evaluate(D,def.filter(i=>i!==id));
  assert(M.dependents(D,id).some(b=>r.str[b.id]<1),id+' pulled should weaken a dependent');
  assert(r.instability>=0.15,id+' pulled should wobble');});
// selectivity is not the single most consequential block
const bs=def.map(id=>[id,M.bearing(D,id)]).sort((a,b)=>b[1]-a[1]);
assert(bs[0][0]!=='sel','selectivity should not be the most consequential block');
console.log('most to least load-bearing:',bs.map(x=>x[0]+' '+x[1]).join(', '));
// some damage shows mainly under stress: pulling diagnostics makes no headline on a quiet day, then fails a stress test
{const r=M.evaluate(D,def.filter(i=>i!=='diag'));assert.equal(M.risks(D,r,bal).headlines.length,0);
 assert(M.stressAll(D,r).some(x=>x.verdict!=='holds'));assert(M.challenges(D,r,bal).quiet);}

// --- bagel is overloaded ---
const rb=M.evaluate(D,M.preset(D,D.PRESETS.find(p=>p.id==='bagel')));assert(rb.dil<1);assert.equal(M.verdict(D,rb).title,'An everything bagel');

// --- tolerance changes headlines, never the numbers ---
const rs=M.evaluate(D,M.preset(D,D.PRESETS.find(p=>p.id==='statecraft')));
const a=M.risks(D,rs,{funding:0,leverage:0,evidence:0,speed:0}),b=M.risks(D,rs,{funding:2,leverage:2,evidence:2,speed:2});
assert(a.headlines.length>=b.headlines.length);assert.equal(a.headlines.length+a.footnotes.length,b.headlines.length+b.footnotes.length);

// --- wording: no percentages, nobody "paid for by" economists ---
for(const p of D.PRESETS){const r=M.evaluate(D,M.preset(D,p)),v=M.verdict(D,r),x=M.risks(D,r,bal);
  const text=[v.title,v.line].concat(x.headlines.map(h=>h.text),x.footnotes.map(h=>h.text),x.gains).join(' | ');
  assert(!/%/.test(text),p.id+' has a percentage: '+text);assert(!/economists|evaluators/i.test(text),p.id+' names economists');assert(!/paid for by/i.test(v.title),p.id);
  console.log('\n'+p.n,'| wobble',r.instability.toFixed(2),'|',v.title,'|',v.line);
  console.log('  stress',D.SHOCKS.map(s=>s.id+':'+M.stress(D,r,s).verdict).join(' '));}
console.log('\nok');
