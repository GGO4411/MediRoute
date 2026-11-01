import 'dotenv/config';
import assert from 'node:assert/strict';
import { searchCorpus } from '../lib/vector';

async function main(){
 const matches=await searchCorpus('A one-sided throbbing headache that becomes worse in bright light, with nausea.',5);
 assert.ok(matches.length>0,'Qdrant should return semantic matches for the seeded routing corpus');
 assert.ok(matches.every(m=>typeof m.score==='number'),'Every match should include a numeric cosine similarity score');
 assert.ok(matches.some(m=>typeof m.specialty==='string'&&typeof m.condition==='string'),'Retrieved points should include routing metadata');
 console.log('Qdrant integration check passed: embedded text, cosine search, and routing metadata retrieval.');
}
main().catch(error=>{console.error(error);process.exit(1);});
