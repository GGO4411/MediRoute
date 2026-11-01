import { strict as assert } from 'node:assert';
import { assessUrgency } from '../lib/triage';
assert.equal(assessUrgency('I have a headache').urgency,'ROUTINE');
assert.equal(assessUrgency('worsening pain and a fever').urgency,'SOON');
assert.equal(assessUrgency('difficulty breathing').urgency,'URGENT');
assert.equal(assessUrgency('chest pain and cannot breathe').urgency,'EMERGENCY');
console.log('Triage rule smoke tests passed.');
