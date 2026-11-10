import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession,hasPermission } from '@/lib/auth';
import { ensureCollection,qdrant,COLLECTION,pointId } from '@/lib/vector';
import { embed } from '@/lib/embeddings';
import { serverError } from '@/lib/http';

const schema=z.object({
 id:z.string().min(2).max(100),
 condition:z.string().min(3).max(180),
 description:z.string().min(10).max(2500),
 specialty:z.string().min(2).max(100),
 keywords:z.array(z.string().max(60)).max(30).default([])
});
async function authorize(req:NextRequest){
 const user=await getSession(req);
 if(!user)return {response:NextResponse.json({error:'Authentication required.'},{status:401})};
 if(!(await hasPermission(user.userId,'ROUTING_MANAGE')))
  return {response:NextResponse.json({error:'Database permission denied.'},{status:403})};
 return {response:null};
}
export async function GET(req:NextRequest){
 try{
  const auth=await authorize(req);if(auth.response)return auth.response;
  await ensureCollection();
  const result=await qdrant().scroll(COLLECTION,{limit:100,with_payload:true,with_vector:false});
  const entries=result.points.map(point=>{
   const payload=(point.payload||{}) as Record<string,unknown>;
   return {id:String(payload.id||point.id),condition:String(payload.condition||''),description:String(payload.description||''),specialty:String(payload.specialty||''),keywords:Array.isArray(payload.keywords)?payload.keywords:[],source:String(payload.source||'')};
  });
  return NextResponse.json({entries});
 }catch(e){return serverError(e);}
}
export async function POST(req:NextRequest){
 try{
  const auth=await authorize(req);if(auth.response)return auth.response;
  const p=schema.safeParse(await req.json());
  if(!p.success)return NextResponse.json({error:'Invalid corpus entry.'},{status:400});
  await ensureCollection();
  const vector=await embed(p.data.condition+'. '+p.data.description+'. Symptoms: '+p.data.keywords.join(', '));
  await qdrant().upsert(COLLECTION,{wait:true,points:[{id:pointId(p.data.id),vector,payload:{...p.data,source:'admin-curated'}}]});
  return NextResponse.json({message:'Routing concept created or updated.'},{status:201});
 }catch(e){return serverError(e);}
}
export async function DELETE(req:NextRequest){
 try{
  const auth=await authorize(req);if(auth.response)return auth.response;
  const parsed=z.string().min(2).max(100).safeParse(req.nextUrl.searchParams.get('id'));
  if(!parsed.success)return NextResponse.json({error:'A valid corpus entry ID is required.'},{status:400});
  await ensureCollection();
  await qdrant().delete(COLLECTION,{points:[pointId(parsed.data)],wait:true});
  return NextResponse.json({message:'Routing concept deleted from the vector collection.'});
 }catch(e){return serverError(e);}
}
