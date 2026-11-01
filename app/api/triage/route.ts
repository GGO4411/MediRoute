import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { assessUrgency,EMERGENCY_MESSAGE } from '@/lib/triage';
import { searchCorpus } from '@/lib/vector';
import { serverError } from '@/lib/http';
const schema=z.object({symptoms:z.string().trim().min(10).max(3000)});
export async function POST(req:NextRequest){
 try{const user=await getSession(req);if(!user)return NextResponse.json({error:'Sign in to submit symptoms.'},{status:401});
  if(user.role!=='PATIENT')return NextResponse.json({error:'Only patient accounts can submit symptoms.'},{status:403});
  const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:'Describe symptoms in at least 10 characters.'},{status:400});
  const {urgency,score,flags}=assessUrgency(p.data.symptoms);let matches:any[]=[];let vectorAvailable=true;
  try{matches=await searchCorpus(p.data.symptoms,5);}catch(e){console.error('Vector search:',e);vectorAvailable=false;}
  const [r]=await db().execute<any>('INSERT INTO triage_sessions(patient_id,symptom_text,urgency,urgency_score,safety_flags,top_matches) VALUES(?,?,?,?,?,?)',[user.userId,p.data.symptoms,urgency,score,JSON.stringify(flags),JSON.stringify(matches)]);
  const specialties=Array.from(new Set(matches.map(m=>String(m.specialty||'')).filter(Boolean)));let doctors:any[]=[];
  if(specialties.length){const marks=specialties.map(()=>'?').join(',');const [rows]=await db().execute<any[]>(`SELECT * FROM v_doctor_directory WHERE is_accepting_patients=1 AND specialty IN (${marks}) ORDER BY years_experience DESC`,specialties);doctors=rows;}
  return NextResponse.json({triageId:Number(r.insertId),urgency,urgencyScore:score,flags,emergencyMessage:urgency==='EMERGENCY'?EMERGENCY_MESSAGE:null,matches,doctors,vectorAvailable,disclaimer:'Administrative routing suggestions only. This is not a diagnosis and does not replace evaluation by a qualified healthcare professional.'});
 }catch(e){return serverError(e);}
}
