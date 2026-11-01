import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'node:crypto';
import { embed } from './embeddings';
export const COLLECTION=process.env.QDRANT_COLLECTION||'medical_routing_v1';
export type CorpusMatch={
 id:string|number;
 score:number;
 condition?:string;
 description?:string;
 specialty?:string;
 keywords?:string[];
 source?:string;
 [key:string]:unknown;
};
export function pointId(key:string):string{
 const h=createHash('sha256').update(key).digest('hex').slice(0,32).split('');
 h[12]='5';h[16]=((parseInt(h[16],16)&3)|8).toString(16);
 const v=h.join('');return v.slice(0,8)+'-'+v.slice(8,12)+'-'+v.slice(12,16)+'-'+v.slice(16,20)+'-'+v.slice(20);
}
let client:QdrantClient|undefined;
export function qdrant(){if(!client)client=new QdrantClient({url:process.env.QDRANT_URL||'http://localhost:6333',apiKey:process.env.QDRANT_API_KEY||undefined});return client;}
export async function ensureCollection(){
 const q=qdrant(),existing=await q.getCollections();
 if(!existing.collections.some(c=>c.name===COLLECTION)){
  await q.createCollection(COLLECTION,{vectors:{size:384,distance:'Cosine'}});
  await q.createPayloadIndex(COLLECTION,{field_name:'specialty',field_schema:'keyword'});
 }
}
export async function searchCorpus(text:string,limit=5):Promise<CorpusMatch[]>{
 const vector=await embed(text);
 const result=await qdrant().search(COLLECTION,{vector,limit,with_payload:true,score_threshold:.20});
 return result.map(p=>({id:p.id,score:p.score,...(p.payload as Record<string,unknown>)})) as CorpusMatch[];
}
