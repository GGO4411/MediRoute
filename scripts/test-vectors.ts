import 'dotenv/config';
import assert from 'node:assert/strict';
import { searchCorpus,qdrant,COLLECTION,pointId } from '../lib/vector';
import { embed } from '../lib/embeddings';

async function main(){
 const matches=await searchCorpus('A one-sided throbbing headache that becomes worse in bright light, with nausea.',5);
 assert.ok(matches.length>0,'Qdrant should return semantic matches for the seeded routing corpus');
 assert.ok(matches.every(m=>typeof m.score==='number'),'Every match should include a numeric cosine similarity score');
 assert.ok(matches.some(m=>typeof m.specialty==='string'&&typeof m.condition==='string'),'Retrieved points should include routing metadata');

 // Exercise create, update/upsert, read and delete with a disposable point.
 const key='dbms-vector-crud-smoke-test',id=pointId(key);
 const vector=await embed('Disposable DBMS vector CRUD smoke test entry.');
 await qdrant().upsert(COLLECTION,{wait:true,points:[{id,vector,payload:{id:key,condition:'CRUD smoke test',specialty:'Test'}}]});
 const created=await qdrant().retrieve(COLLECTION,{ids:[id],with_payload:true,with_vector:false});
 assert.equal(created.length,1,'Qdrant should read back an upserted point');
 await qdrant().upsert(COLLECTION,{wait:true,points:[{id,vector,payload:{id:key,condition:'Updated CRUD smoke test',specialty:'Test'}}]});
 const updated=await qdrant().retrieve(COLLECTION,{ids:[id],with_payload:true,with_vector:false});
 assert.equal(updated[0]?.payload?.condition,'Updated CRUD smoke test','Upsert with a stable ID should update payload data');
 await qdrant().delete(COLLECTION,{points:[id],wait:true});
 const deleted=await qdrant().retrieve(COLLECTION,{ids:[id],with_payload:true,with_vector:false});
 assert.equal(deleted.length,0,'Qdrant delete should remove the disposable point');
 console.log('Qdrant checks passed: semantic retrieval, payload metadata, create/upsert, read and delete.');
}
main().catch(error=>{console.error(error);process.exit(1);});
