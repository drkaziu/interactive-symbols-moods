const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const variants = [['numbers.html', '0123456789'], ['letters.html', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'], ['raidės.html', 'AĄBCČDEĘĖFGHIĮYJKLMNOPRSŠTUŲŪVZŽ']];
const htmlFor = file => readFileSync(join(__dirname, '..', file), 'utf8');
const scriptFor = file => htmlFor(file).match(/<script>([\s\S]*?)<\/script>/)[1];

test('all variants share identical behavior and styles', () => {
  const normalize = s => s.replace(/const easterEgg='[^']+';/, "const easterEgg='';").replace(/const symbols='[^']+';/, "const symbols='';");
  for (const [file] of variants) {
    assert.equal(normalize(scriptFor(file)), normalize(scriptFor('numbers.html')));
    assert.equal(htmlFor(file).match(/<style>([\s\S]*?)<\/style>/)[1],
      htmlFor('numbers.html').match(/<style>([\s\S]*?)<\/style>/)[1]);
  }
});

for (const [file, expected] of variants) {
  test(`${file}: generation, refresh, and selection protection use its character set`, () => {
    const script = scriptFor(file);
    new Function(script);
    const symbols = script.match(/const symbols='([^']+)';/)[1];
    assert.equal(symbols, expected);
    const cells = [], selected = new Set(), pendingRefresh = new Map(), timers = new Map();
    let timerId = 0;
    const math = Object.create(Math);
    math.random = () => 0;
    const context = {
      symbols, cells, selected, pendingRefresh, eggCells: new Set(), placeEasterEgg() {}, gesture: null, hovered: new Set(),
      columns: 2, rows: 1, waveTimer: 0,
      reducedMotion: { matches: false }, Math: math,
      grid: { append() {} },
      document: { hidden: false, createElement() {
        const span = { textContent: '' };
        return { dataset: {}, style: { setProperty() {} },
          classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {},
          set innerHTML(value) { span.textContent = value.match(/<span>(.)<\/span>/)[1]; },
          querySelector: () => span
        };
      } },
      setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
      clearTimeout: id => timers.delete(id)
    };
    vm.createContext(context);
    vm.runInContext(script.slice(script.indexOf('function createCell('), script.indexOf('// Keep the hidden message')), context);
    vm.runInContext(script.slice(script.indexOf('function cancelCellRefresh('), script.indexOf('function refreshScattered(')), context);
    vm.runInContext(script.slice(script.indexOf('function setSelected('), script.indexOf('// Read layout only')), context);
    const nextTimer = () => { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); };
    context.createCell(0);
    assert.equal(cells[0].querySelector().textContent, symbols[0]);
    math.random = () => .999999;
    context.createCell(1);
    assert.equal(cells[1].querySelector().textContent, symbols.at(-1));
    for (const original of symbols) {
      cells[0].querySelector().textContent = original;
      context.scheduleRefresh(cells[0]); nextTimer(); nextTimer();
      const refreshed = cells[0].querySelector().textContent;
      assert(symbols.includes(refreshed)); assert.notEqual(refreshed, original);
    }
    selected.add(0);
    context.scheduleRefresh(cells[0]); assert.equal(timers.size, 0);
    selected.delete(0);
    const before = cells[0].querySelector().textContent;
    context.scheduleRefresh(cells[0]); nextTimer(); selected.add(0); nextTimer();
    assert.equal(cells[0].querySelector().textContent, before);
    assert.equal(pendingRefresh.size, 0);

    // Manual refresh releases existing selections and changes every cell.
    const beforeWave = cells.map(cell => cell.querySelector().textContent);
    context.refreshWave();
    assert.equal(selected.size, 0);
    while (timers.size) nextTimer();
    cells.forEach((cell, i) => assert.notEqual(cell.querySelector().textContent, beforeWave[i]));

    // Selections made after refresh starts still protect pending changes.
    const protectedValue = cells[0].querySelector().textContent;
    context.refreshWave();
    context.setSelected(0, true);
    while (timers.size) nextTimer();
    assert.equal(cells[0].querySelector().textContent, protectedValue);
    assert(selected.has(0));

    // A new refresh also resets a selection made during an unfinished wave.
    context.refreshWave();
    context.setSelected(1, true);
    context.refreshWave();
    assert.equal(selected.size, 0);
    while (timers.size) nextTimer();
    assert.equal(pendingRefresh.size, 0);
  });
}

for (const [file] of variants) {
  test(`${file}: ambient refresh uses irregular single-symbol arrivals and respects protection`, () => {
    const script=scriptFor(file);
    let random=.2;
    const math=Object.create(Math);math.random=()=>random;
    const cells=Array.from({length:300},(_,i)=>({id:i}));
    const protectedIds=new Set([0,1,2]);
    const scheduled=[],timers=[];
    const c={cells,Math:math,eggCells:new Set([999]),waveTimer:0,gesture:null,document:{hidden:false},
      pendingRefresh:new Map(),
      canRefresh:cell=>!protectedIds.has(cell.id),
      scheduleRefresh:(cell,delay,automatic)=>scheduled.push({cell,delay,automatic}),
      setTimeout:(fn,delay)=>timers.push({fn,delay})};
    vm.createContext(c);
    vm.runInContext(script.slice(script.indexOf('function refreshScattered('),script.indexOf("document.addEventListener('visibilitychange'")),c);
    c.refreshScattered();
    assert.equal(scheduled.length,1);
    assert.equal(scheduled[0].delay,0);
    assert.equal(scheduled[0].automatic,true);
    assert(!protectedIds.has(scheduled[0].cell.id));
    c.pendingRefresh.set(scheduled[0].cell,1);
    c.refreshScattered();
    assert.notEqual(scheduled[1].cell,scheduled[0].cell);
    for (const r of [.02,.25,.6,.95]) {random=r;c.scheduleAmbientRefresh();}
    assert(timers.every(timer=>Number.isFinite(timer.delay)&&timer.delay>=180));
    assert.equal(new Set(timers.map(timer=>timer.delay)).size,4);
    const before=scheduled.length;
    c.waveTimer=1;c.refreshScattered();c.waveTimer=0;
    c.gesture={};c.refreshScattered();c.gesture=null;
    c.document.hidden=true;c.refreshScattered();c.document.hidden=false;
    assert.equal(scheduled.length,before);
    cells.forEach(cell=>protectedIds.add(cell.id));
    c.refreshScattered();
    assert.equal(scheduled.length,before);
  });
}

for (const [file, expectedEgg] of [['numbers.html','42'],['letters.html','HELLO'],['raidės.html','LABAS']]) {
  function setupEgg(columns=10,rows=4) {
    const script=scriptFor(file),timers=new Map();let id=0,seed=19;
    const math=Object.create(Math);
    math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    const cells=Array.from({length:columns*rows},(_,i)=>{
      const span={textContent:file==='numbers.html'?'0':'Z'};
      return {dataset:{index:String(i)},querySelector:()=>span,
        classList:{add(){},remove(){},toggle(){}},setAttribute(){}};
    });
    const c={cells,columns,rows,Math:math,selected:new Set(),eggCells:new Set(),
      easterEgg:script.match(/const easterEgg='([^']+)';/)[1],
      symbols:script.match(/const symbols='([^']+)';/)[1],
      pendingRefresh:new Map(),waveTimer:0,gesture:null,document:{hidden:false},
      hovered:new Set(),reducedMotion:{matches:false},
      setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(id){timers.delete(id);}};
    vm.createContext(c);
    vm.runInContext(script.slice(script.indexOf('function placeEasterEgg('),script.indexOf('// Broad, overlapping')),c);
    vm.runInContext(script.slice(script.indexOf('function cancelCellRefresh('),script.indexOf('function scheduleAmbientRefresh(')),c);
    vm.runInContext(script.slice(script.indexOf('function setSelected('),script.indexOf('// Read layout only')),c);
    c.flush=()=>{while(timers.size){const [key,fn]=timers.entries().next().value;timers.delete(key);fn();}};
    c.message=()=>[...c.eggCells].map(i=>cells[i].querySelector().textContent).join('');
    assert.equal(c.easterEgg,expectedEgg);
    return c;
  }
  test(`${file}: hidden message survives ambient and manual refresh with ordinary selection`,()=>{
    const c=setupEgg();c.placeEasterEgg();
    assert.equal(c.message(),expectedEgg);
    const indices=[...c.eggCells];
    assert.equal(Math.floor(indices[0]/c.columns),Math.floor(indices.at(-1)/c.columns));
    for(let i=0;i<50;i++){c.refreshScattered();c.flush();assert.equal(c.message(),expectedEgg);}
    c.setSelected(indices[0],true);
    assert(c.selected.has(indices[0]));
    c.refreshWave();
    assert.equal(c.selected.size,0);
    assert.equal(c.message(),expectedEgg);
    c.flush();assert.equal(c.message(),expectedEgg);
    assert.notDeepEqual([...c.eggCells],indices);
  });
  test(`${file}: placement cancels pending changes and never overwrites selected symbols`,()=>{
    const c=setupEgg();
    c.cells.forEach(cell=>c.scheduleRefresh(cell,100));
    c.selected.add(0);
    const selectedText=c.cells[0].querySelector().textContent;
    c.placeEasterEgg();
    assert.equal(c.message(),expectedEgg);
    assert.equal(c.cells[0].querySelector().textContent,selectedText);
    for(const i of c.eggCells)assert(!c.pendingRefresh.has(c.cells[i]));
    c.flush();assert.equal(c.message(),expectedEgg);
  });
  test(`${file}: narrow and temporarily crowded fields recover when space becomes available`,()=>{
    const c=setupEgg(1,8);c.placeEasterEgg();
    assert.equal(c.message(),expectedEgg);
    c.columns=2;c.rows=1;c.cells.length=2;c.placeEasterEgg();
    assert.equal(c.message(),expectedEgg.length<=2?expectedEgg:'');
    const d=setupEgg();
    d.cells.forEach((_,i)=>d.selected.add(i));d.placeEasterEgg();
    assert.equal(d.eggCells.size,0);
    d.clear();d.refreshScattered();
    assert.equal(d.message(),expectedEgg);
  });
}
