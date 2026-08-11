const assert = require('assert');
const { filterTypesBySelections } = require('../js/script.js');

const types = [
  { name: 'Type 1', observer: 'Observer', oeoi: 'Oe', dedi: 'De', tf: 'F', ns: 'N' },
  { name: 'Type 2', observer: 'Observer', oeoi: 'Oe', dedi: 'Di', tf: 'F', ns: 'S' },
  { name: 'Type 3', observer: 'Decider', oeoi: 'Oi', dedi: 'De', tf: 'T', ns: 'N' }
];

const selections = { observer: 'Observer', oeoi: 'Oe' };

const filtered = filterTypesBySelections(types, selections);

assert.strictEqual(filtered.length, 2);
assert.strictEqual(filtered[0].name, 'Type 1');
assert.strictEqual(filtered[1].name, 'Type 2');
console.log('filter test passed');
