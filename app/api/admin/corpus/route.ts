import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { ensureCollection,qdrant,COLLECTION,pointId } from '@/lib/vector';
import { embed } from '@/lib/embeddings';
import { serverError } from '@/lib/http';
const schema=z.object({id:z.string().min(2).max(100),condition:z.string().min(3).max(180),description:z.string().min(10).max(2500),specialty:z.string().min(2).max(100),keywords:z.array(z.string().max(60)).max(30).default([])});
export async function POST(req:NextRequest){
 try{const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});if(user.role!=='ADMIN')return NextResponse.json({error:'Administrator access required.'},{status:403});
  const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:'Invalid corpus entry.'},{status:400});
  await ensureCollection();const vector=await embed(p.data.condition+'. '+p.data.description+'. Symptoms: '+p.data.keywords.join(', '));
  await qdrant().upsert(COLLECTION,{wait:true,points:[{id:pointId(p.data.id),vector,payload:{...p.data,source:'admin-curated'}}]});
  return NextResponse.json({message:'Corpus entry indexed.'},{status:201});
 }catch(e){return serverError(e);}
}
