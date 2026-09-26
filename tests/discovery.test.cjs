const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
for(const file of ['numbers.html','letters.html','raidės.html']){
 function setup(reduced=false){
  const source=readFileSync(join(__dirname,'..',file),'utf8');
  const classes=()=>{const values=new Set();return {add:(...xs)=>xs.forEach(x=>values.add(x)),remove:(...xs)=>xs.forEach(x=>values.delete(x)),contains:x=>values.has(x),toggle:(x,on)=>on?values.add(x):values.delete(x)}};
  const cells=Array.from({length:20},()=>({classList:classes(),style:{removeProperty(){}},setAttribute(){}}));
  const ripple={classList:classes(),style:{}},timers=new Map(),frames=new Map();let id=0;
  const word=source.match(/const easterEgg='([^']+)'/)[1];
  const c={cells,easterEgg:word,eggCells:new Set(Array.from({length:word.length},(_,i)=>i)),selected:new Set(),hovered:new Set(),
   reducedMotion:{matches:reduced},document:{hidden:false,querySelector:()=>ripple},
   centers:cells.map((_,i)=>({x:i*52,y:36})),fieldBounds:{left:0,top:0},readGeometry(){},cancelCellRefresh(){},
   setTimeout(fn,delay){timers.set(++id,{fn,delay});return id},clearTimeout:id=>timers.delete(id),
   requestAnimationFrame(fn){frames.set(++id,fn);return id},cancelAnimationFrame:id=>frames.delete(id)};
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('// A completed selection'),source.indexOf('// Recheck protection')),c);
  vm.runInContext(source.slice(source.indexOf('function setSelected('),source.indexOf('// Read layout only')),c);
  return {c,cells,ripple,timers,frame(){const fs=[...frames.values()];frames.clear();fs.forEach(fn=>fn())},tick(){const [key,t]=timers.entries().next().value;timers.delete(key);t.fn();return t.delay},select(){c.eggCells.forEach(i=>c.setSelected(i,true))}};
 }
 test(`${file}: full selection triggers stillness then one ripple, and can be rearmed`,()=>{
  const s=setup(),{c,cells,ripple,timers}=s;
  c.setSelected(0,true);s.frame();assert.equal(timers.size,0);
  s.select();s.frame();assert(cells[0].discoveryStill);assert(!cells.at(-1).discoveryStill);
  assert(!ripple.classList.contains('active'));
  assert.equal(s.tick(),2000);assert(cells.every(cell=>!cell.discoveryStill));assert(ripple.classList.contains('active'));
  assert.equal(s.tick(),1800);assert(!ripple.classList.contains('active'));
  c.setSelected(19,true);s.frame();assert.equal(timers.size,0);
  c.setSelected(0,false);s.frame();c.setSelected(0,true);s.frame();assert.equal(timers.size,1);
 });
 test(`${file}: deselection and reset cancel pending effects without clearing selection`,()=>{
  const s=setup();s.select();s.frame();s.c.setSelected(0,false);s.frame();
  assert.equal(s.timers.size,0);assert(s.cells.every(cell=>!cell.discoveryStill));
  s.c.setSelected(0,true);s.frame();s.tick();s.c.resetDiscovery();
  assert.equal(s.timers.size,0);assert(!s.ripple.classList.contains('active'));assert.equal(s.c.selected.size,s.c.eggCells.size);
 });
 test(`${file}: reduced motion uses a stationary glow and hidden pages do not trigger`,()=>{
  const s=setup(true);s.select();s.frame();
  assert(s.cells[0].classList.contains('discovery-glow'));assert(s.cells.every(cell=>!cell.discoveryStill));
  s.tick();assert(!s.cells[0].classList.contains('discovery-glow'));assert(!s.ripple.classList.contains('active'));
  s.c.clear();s.frame();s.c.document.hidden=true;s.select();s.frame();assert.equal(s.timers.size,0);
 });
}
