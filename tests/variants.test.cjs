const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const variants = [['numbers.html', '0123456789'], ['letters.html', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'], ['raidės.html', 'AĄBCČDEĘĖFGHIĮYJKLMNOPRSŠTUŲŪVZŽ']];
const htmlFor = file => readFileSync(join(__dirname, '..', file), 'utf8');
const scriptFor = file => htmlFor(file).match(/<script>([\s\S]*?)<\/script>/)[1];

test('all variants share identical behavior and styles', () => {
  const normalize = s => s.replace(/const symbols='[^']+';/, "const symbols='';");
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
      symbols, cells, selected, pendingRefresh, gesture: null, hovered: new Set(),
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
    vm.runInContext(script.slice(script.indexOf('function createCell('), script.indexOf('// Broad, overlapping')), context);
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
