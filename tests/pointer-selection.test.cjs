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
  html.indexOf("field.addEventListener('pointerdown'"),
  html.indexOf("document.addEventListener('keydown'")
);

function setup() {
  const handlers = {}, captures = [], selected = new Set();
  const cells = [0, 1, 2].map(i => ({
    dataset: { index: String(i) },
    getBoundingClientRect: () => ({ left: i * 52, top: 0, width: 52, height: 72 })
  }));
  const box = { style: { display: 'none' } };
  const context = {
    gesture: null, cells, box, selected,
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
  return { send, context, captures, selected, box };
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
  const { send, context, box, selected } = setup();
  send('pointerdown', 1, { clientX: 0, clientY: 0 });
  for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
    send(type, 2, { clientX: 150, clientY: 72 });
    assert.equal(context.gesture.pointerId, 1);
    assert.equal(context.gesture.moved, false);
    assert.equal(box.style.display, 'none');
  }
  send('pointermove', 1, { clientX: 104, clientY: 72 });
  assert.deepEqual([...selected], [0, 1]);
  send('pointerup', 1);
  assert.equal(context.gesture, null);
  assert.equal(box.style.display, 'none');
});

for (const type of ['pointercancel', 'lostpointercapture']) {
  test(`${type} ends the matching gesture and permits another selection`, () => {
    const { send, context, box, selected } = setup();
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

}
