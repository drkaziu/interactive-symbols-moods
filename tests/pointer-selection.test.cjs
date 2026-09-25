const { test: runTest } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

for (const filename of ['numbers.html', 'letters.html', 'raidės.html']) {
const test = (name, fn) => runTest(`${filename}: ${name}`, fn);
const html = readFileSync(join(__dirname, '..', filename), 'utf8');
// Exercise the actual pointer handlers without requiring a browser dependency.
const handlersSource = html.slice(
  html.indexOf("let selectionFrame=0;"),
  html.indexOf("document.addEventListener('keydown'")
);

function setup() {
  const handlers = {}, captures = [], selected = new Set(), frames = new Map();
  let frameId=0, geometryReads=0;
  const cells = [0, 1, 2].map(i => ({
    dataset: { index: String(i) },
    getBoundingClientRect: () => ({ left: i * 52, top: 0, width: 52, height: 72 })
  }));
  const box = { style: { display: 'none' } };
  const context = {
    gesture: null, cells, box, selected, centers: null, fieldBounds: null,
    requestAnimationFrame(fn) { const id=++frameId;frames.set(id,fn);return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    readGeometry() {
      if(context.centers)return;
      geometryReads++;
      context.fieldBounds={left:0,top:0};
      context.centers=cells.map(cell=>{const r=cell.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
    },
    field: {
      addEventListener: (name, handler) => { handlers[name] = handler; },
      setPointerCapture: id => captures.push(id),
      getBoundingClientRect: () => ({ left: 0, top: 0 })
    },
    clear: () => selected.clear(),
    setSelected: (i, on) => on ? selected.add(i) : selected.delete(i)
  };
  vm.createContext(context);
  vm.runInContext(handlersSource, context);
  function send(type, pointerId, overrides = {}) {
    const index = overrides.index ?? 0;
    handlers[type]({
      pointerId, button: 0, isPrimary: true, pointerType: 'touch',
      clientX: index * 52 + 26, clientY: 36, shiftKey: false,
      target: { closest: () => cells[index] }, preventDefault() {}, ...overrides
    });
  }
  function frame() { const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn()); }
  return { send, context, captures, selected, box, frame, frames, reads:()=>geometryReads };
}

test('primary tap remains functional', () => {
  const { send, selected } = setup();
  send('pointerdown', 1); send('pointerup', 1);
  assert.deepEqual([...selected], [0]);
});

test('second finger cannot replace the original tap', () => {
  const { send, selected, captures } = setup();
  send('pointerdown', 1);
  send('pointerdown', 2, { index: 1, isPrimary: false });
  send('pointerup', 1);
  assert.deepEqual([...selected], [0]);
  assert.deepEqual(captures, [1]);
  send('pointerup', 2);
  assert.deepEqual([...selected], [0]);
});

test('other pointer moves, releases, and cancellations leave the active drag intact', () => {
  const { send, context, box, selected, frame } = setup();
  send('pointerdown', 1, { clientX: 0, clientY: 0 });
  for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
    send(type, 2, { clientX: 150, clientY: 72 });
    assert.equal(context.gesture.pointerId, 1);
    assert.equal(context.gesture.moved, false);
    assert.equal(box.style.display, 'none');
  }
  send('pointermove', 1, { clientX: 104, clientY: 72 });
  frame();
  assert.deepEqual([...selected], [0, 1]);
  send('pointerup', 1);
  assert.equal(context.gesture, null);
  assert.equal(box.style.display, 'none');
});

for (const type of ['pointercancel', 'lostpointercapture']) {
  test(`${type} ends the matching gesture and permits another selection`, () => {
    const { send, context, box, selected, frame } = setup();
    send('pointerdown', 1, { clientX: 0, clientY: 0 });
    send('pointermove', 1, { clientX: 52, clientY: 72 });
    send(type, 1);
    assert.equal(context.gesture, null);
    assert.equal(box.style.display, 'none');
    send('pointerdown', 3, { index: 2 }); send('pointerup', 3);
    assert.deepEqual([...selected], [2]);
  });
}

test('rejects non-primary, non-left, and concurrent pointer starts', () => {
  const { send, context, captures } = setup();
  send('pointerdown', 2, { isPrimary: false });
  send('pointerdown', 3, { button: 2 });
  assert.equal(context.gesture, null);
  send('pointerdown', 1);
  send('pointerdown', 4); // Another device may also mark its pointer as primary.
  assert.equal(context.gesture.pointerId, 1);
  assert.deepEqual(captures, [1]);
});

test('shift selection still preserves existing selected digits', () => {
  const { send, selected } = setup();
  selected.add(0);
  send('pointerdown', 1, { index: 1, shiftKey: true });
  send('pointerup', 1);
  assert.deepEqual([...selected], [0, 1]);
});

test('drag coalesces moves, caches geometry, and flushes the final pending move on release', () => {
  const {send,frame,frames,selected,reads}=setup();
  send('pointerdown',1,{clientX:0,clientY:0});
  for(let x=10;x<=104;x++)send('pointermove',1,{clientX:x,clientY:72});
  assert.equal(frames.size,1);
  assert.equal(reads(),0);
  frame();
  assert.deepEqual([...selected],[0,1]);
  assert.equal(reads(),1);
  send('pointermove',1,{clientX:156,clientY:72});
  send('pointerup',1,{clientX:156,clientY:72});
  assert.deepEqual([...selected],[0,1,2]);
  assert.equal(reads(),1);
  assert.equal(frames.size,0);
});

test('cancelled pending drag cannot change a later selection', () => {
  const {send,frame,frames,selected}=setup();
  send('pointerdown',1,{clientX:0,clientY:0});
  send('pointermove',1,{clientX:104,clientY:72});
  send('pointercancel',1);
  assert.equal(frames.size,0);
  send('pointerdown',2,{index:2});send('pointerup',2,{index:2});
  frame();
  assert.deepEqual([...selected],[2]);
});

}
