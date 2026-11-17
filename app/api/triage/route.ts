import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession,hasPermission } from '@/lib/auth';
import { db,DBRow } from '@/lib/db';
import { assessUrgency,EMERGENCY_MESSAGE,normalizeSymptomText } from '@/lib/triage';
import type { Urgency } from '@/lib/triage';
import { hasUsefulSpecialtyMatch,searchCorpus } from '@/lib/vector';
import type { CorpusMatch } from '@/lib/vector';
import { readJsonBody,serverError,validationError } from '@/lib/http';
import type { ResultSetHeader } from 'mysql2';
const schema=z.object({symptoms:z.string().trim().min(10).max(3000)});
export async function POST(req:NextRequest){
 try{
  const user=await getSession(req);if(!user)return NextResponse.json({error:'Sign in to submit symptoms.'},{status:401});
  if(!(await hasPermission(user.userId,'TRIAGE_CREATE')))return NextResponse.json({error:'Your database role does not permit symptom submissions.'},{status:403});
  const body=await readJsonBody(req);if(!body.ok)return body.response;const p=schema.safeParse(body.value);if(!p.success)return validationError(p.error,'Describe symptoms in at least 10 characters.');
  const normalizedSymptoms=normalizeSymptomText(p.data.symptoms);
  const ruleAssessment=assessUrgency(normalizedSymptoms);let urgency:Urgency=ruleAssessment.urgency,score=ruleAssessment.score,flags=ruleAssessment.flags;
  let matches:CorpusMatch[]=[];let vectorAvailable=true;let triageId=0;
  // The urgency procedure runs before retrieval. Emergency flags stop specialist routing.
  const conn=await db().getConnection();
  try{
   await conn.query('CALL sp_calculate_urgency(?, @mediroute_score, @mediroute_level)',[normalizedSymptoms]);
   const [scoreRows]=await conn.query<DBRow[]>('SELECT @mediroute_score AS score, @mediroute_level AS level');
   if(scoreRows[0]){score=Number(scoreRows[0].score||0);urgency=scoreRows[0].level;if(urgency!=='ROUTINE'&&!flags.length)flags=['A database-side urgency rule matched a warning phrase.'];}
   if(urgency!=='EMERGENCY'){
    try{matches=await searchCorpus(normalizedSymptoms,5);}catch(e){console.error('Vector search:',e);vectorAvailable=false;}
   }
   const [r]=await conn.execute<ResultSetHeader>('INSERT INTO triage_sessions(patient_id,symptom_text,urgency,urgency_score,safety_flags,top_matches) VALUES(?,?,?,?,?,?)',[user.userId,p.data.symptoms,urgency,score,JSON.stringify(flags),JSON.stringify(matches)]);
   triageId=Number(r.insertId);
  }finally{conn.release();}
  const specialties=Array.from(new Set(matches.map(m=>String(m.specialty||'')).filter(Boolean)));let doctors:DBRow[]=[];
  const usefulMatch=hasUsefulSpecialtyMatch(matches);
  if(urgency!=='EMERGENCY'&&usefulMatch&&specialties.length){
   const marks=specialties.map(()=>'?').join(',');
   const [rows]=await db().execute<DBRow[]>(`SELECT doctor_id,doctor_name,specialty,qualification,years_experience,consultation_fee,bio,is_accepting_patients FROM v_doctor_directory WHERE is_accepting_patients=1 AND specialty IN (${marks}) ORDER BY years_experience DESC`,specialties);
   doctors=rows;
  }
  return NextResponse.json({triageId,urgency,urgencyScore:score,flags,emergencyMessage:urgency==='EMERGENCY'?EMERGENCY_MESSAGE:null,matches,doctors,vectorAvailable,routingSkipped:urgency==='EMERGENCY',lowConfidence:matches.length>0&&!usefulMatch,disclaimer:'Administrative routing suggestions only. Similarity is not a probability or diagnosis. This is not a diagnosis and does not replace evaluation by a qualified healthcare professional.'});
 }catch(e){return serverError(e);}
}
