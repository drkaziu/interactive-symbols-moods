const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

for (const file of ['numbers.html', 'letters.html', 'raidės.html']) {
  function setup() {
    const html = readFileSync(join(__dirname, '..', file), 'utf8');
    const source = html.slice(html.indexOf('// Broad, overlapping'), html.indexOf('// Match the fixed CSS tracks:'));
    let seed = 7;
    const math = Object.create(Math);
    math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const cells = Array.from({ length: 6 }, () => {
      const rates = [];
      return {
        motionVariation: .5, rates,
        style: { setProperty(k, v) { this[k] = v; } },
        querySelector: () => ({ getAnimations: () => [{ animationName: 'drift', updatePlaybackRate: rate => rates.push(rate) }] })
      };
    });
    const context = {
      Math: math, cells, selected: new Set(), columns: 3, rows: 2,
      reducedMotion: { matches: false }, document: { hidden: false },
      hoverPoint: null, hoverFrame: 0, requestAnimationFrame: () => 1, renderHover() {}
    };
    vm.createContext(context);
    vm.runInContext(source + '\nglobalThis.state={moodRegions,moodTransitions};', context);
    return context;
  }

  test(`${file}: mood paths remain smooth and bounded through multiple target changes`, () => {
    const c = setup();
    const snapshot = () => c.state.moodRegions.map(r => [r.x, r.y, r.strength]);
    const initial = snapshot();
    for (let tick = 0; tick < 800; tick++) {
      const before = snapshot();
      c.advanceMoods(250);
      c.state.moodRegions.forEach((region, i) => {
        assert(region.x >= .08 - 1e-12 && region.x <= .92 + 1e-12);
        assert(region.y >= .08 - 1e-12 && region.y <= .92 + 1e-12);
        assert(region.strength >= .75 - 1e-12 && region.strength <= 1.25 + 1e-12);
        [region.x, region.y, region.strength].forEach((value, j) => assert(Math.abs(value - before[i][j]) < .015));
        assert(c.state.moodTransitions[i].duration >= 45000 && c.state.moodTransitions[i].duration <= 75000);
      });
      assert(Object.values(c.moodAt(.5, .5)).every(Number.isFinite));
    }
    assert.notDeepEqual(snapshot(), initial);
  });

  test(`${file}: selected moods freeze and animation duration does not reset`, () => {
    const c = setup();
    c.applyMoods();
    const selectedMood = JSON.stringify(c.cells[0].mood);
    const selectedStyle = JSON.stringify(c.cells[0].style);
    const initialDuration = c.cells[1].style['--duration'];
    c.selected.add(0);
    c.advanceMoods(30000); c.applyMoods();
    assert.equal(JSON.stringify(c.cells[0].mood), selectedMood);
    assert.equal(JSON.stringify(c.cells[0].style), selectedStyle);
    assert.equal(c.cells[0].rates.length, 0);
    assert.equal(c.cells[1].style['--duration'], initialDuration);
    assert(c.cells[1].rates.every(rate => Number.isFinite(rate) && rate > 0));
    assert.equal(c.cells[1].rates.length, 1);
    c.selected.delete(0); c.applyMoods();
    assert.notEqual(JSON.stringify(c.cells[0].mood), selectedMood);
  });

  test(`${file}: hidden and reduced-motion modes suspend wandering without a catch-up jump`, () => {
    const c = setup();
    const snapshot = () => JSON.stringify(c.state.moodRegions);
    c.updateMoodTime(100); c.updateMoodTime(350);
    const beforePause = snapshot();
    c.document.hidden = true; c.updateMoodTime(60000);
    assert.equal(snapshot(), beforePause);
    c.document.hidden = false; c.reducedMotion.matches = true; c.updateMoodTime(120000);
    assert.equal(snapshot(), beforePause);
    c.reducedMotion.matches = false;
    const elapsed = c.state.moodTransitions[0].elapsed;
    c.updateMoodTime(180000);
    assert.equal(c.state.moodTransitions[0].elapsed - elapsed, 1000);
  });
}
