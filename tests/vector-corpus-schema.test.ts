import assert from 'node:assert/strict';
import { vectorCorpusEntrySchema } from '../lib/vector-corpus-schema';

const valid={id:'neurology-migraine',condition:'Migraine',description:'Head pain with possible light sensitivity.',specialty:' Neurology ',keywords:[' light sensitivity ']};
const parsed=vectorCorpusEntrySchema.parse(valid);
assert.equal(parsed.specialty,'Neurology','corpus fields are normalized before storage');
assert.deepEqual(parsed.keywords,['light sensitivity']);
assert.throws(()=>vectorCorpusEntrySchema.parse({...valid,specialty:'   '}),'blank specialties are rejected');
assert.throws(()=>vectorCorpusEntrySchema.parse({...valid,keywords:['   ']}),'blank keywords are rejected');
assert.throws(()=>vectorCorpusEntrySchema.parse({...valid,keywords:Array.from({length:31},()=> 'symptom')}),'overlong keyword lists are rejected');
console.log('Vector corpus metadata validation checks passed.');
