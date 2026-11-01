import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { db,DBRow } from '@/lib/db';
import { assessUrgency,EMERGENCY_MESSAGE } from '@/lib/triage';
import { searchCorpus } from '@/lib/vector';
import { serverError } from '@/lib/http';
const schema=z.object({symptoms:z.string().trim().min(10).max(3000)});
export async function POST(req:NextRequest){
 try{
  const user=await getSession(req);if(!user)return NextResponse.json({error:'Sign in to submit symptoms.'},{status:401});
  if(user.role!=='PATIENT')return NextResponse.json({error:'Only patient accounts can submit symptoms.'},{status:403});
  const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:'Describe symptoms in at least 10 characters.'},{status:400});
  const ruleAssessment=assessUrgency(p.data.symptoms);let urgency=ruleAssessment.urgency,score=ruleAssessment.score,flags=ruleAssessment.flags;
  let matches:any[]=[];let vectorAvailable=true;
  try{matches=await searchCorpus(p.data.symptoms,5);}catch(e){console.error('Vector search:',e);vectorAvailable=false;}
  // Call the stored procedure on one pooled connection so its OUT session variables
  // are read from the same MySQL connection that executed the procedure.
  const conn=await db().getConnection();let triageId=0;
  try{
   await conn.query('CALL sp_calculate_urgency(?, @mediroute_score, @mediroute_level)',[p.data.symptoms]);
   const [scoreRows]:any=await conn.query('SELECT @mediroute_score AS score, @mediroute_level AS level');
   if(scoreRows[0]){score=Number(scoreRows[0].score||0);urgency=scoreRows[0].level;if(urgency!=='ROUTINE'&&!flags.length)flags=['A database-side urgency rule matched a warning phrase.'];}
   const [r]=await conn.execute<any>('INSERT INTO triage_sessions(patient_id,symptom_text,urgency,urgency_score,safety_flags,top_matches) VALUES(?,?,?,?,?,?)',[user.userId,p.data.symptoms,urgency,score,JSON.stringify(flags),JSON.stringify(matches)]);
   triageId=Number(r.insertId);
  }finally{conn.release();}
  const specialties=Array.from(new Set(matches.map(m=>String(m.specialty||'')).filter(Boolean)));let doctors:any[]=[];
  if(specialties.length){const marks=specialties.map(()=>'?').join(',');const [rows]=await db().execute<DBRow[]>(`SELECT * FROM v_doctor_directory WHERE is_accepting_patients=1 AND specialty IN (${marks}) ORDER BY years_experience DESC`,specialties);doctors=rows;}
  return NextResponse.json({triageId,urgency,urgencyScore:score,flags,emergencyMessage:urgency==='EMERGENCY'?EMERGENCY_MESSAGE:null,matches,doctors,vectorAvailable,disclaimer:'Administrative routing suggestions only. This is not a diagnosis and does not replace evaluation by a qualified healthcare professional.'});
 }catch(e){return serverError(e);}
}
