import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { db,DBRow } from '@/lib/db';
import { serverError } from '@/lib/http';
const schema=z.object({appointmentId:z.number().int().positive(),patientId:z.number().int().positive(),diagnosisNotes:z.string().max(3000).optional(),medicationName:z.string().min(1).max(180),dosage:z.string().max(120).optional(),instructions:z.string().max(2000).optional()});
export async function GET(req:NextRequest){
 try{const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  let sql='SELECT p.prescription_id AS prescriptionId,p.appointment_id AS appointmentId,p.patient_id AS patientId,p.diagnosis_notes AS diagnosisNotes,p.medication_name AS medicationName,p.dosage,p.instructions,p.prescribed_at AS prescribedAt,u.full_name AS doctorName FROM prescriptions p JOIN users u ON u.user_id=(SELECT d.user_id FROM doctors d WHERE d.doctor_id=p.doctor_id)';
  let args:number[]=[];if(user.role==='PATIENT'){sql+=' WHERE p.patient_id=?';args=[user.userId];}
  else if(user.role==='DOCTOR'){const [d]=await db().execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);if(!d[0])return NextResponse.json({prescriptions:[]});sql+=' WHERE p.doctor_id=?';args=[Number(d[0].doctor_id)];}
  sql+=' ORDER BY p.prescribed_at DESC LIMIT 100';const [rows]=await db().execute<DBRow[]>(sql,args);return NextResponse.json({prescriptions:rows});
 }catch(e){return serverError(e);}
}
export async function POST(req:NextRequest){
 try{const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});if(!['DOCTOR','ADMIN'].includes(user.role))return NextResponse.json({error:'Only a doctor can create a prescription.'},{status:403});
  const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:'Invalid prescription details.'},{status:400});
  const [rows]=await db().execute<DBRow[]>('SELECT appointment_id,patient_id,doctor_id,status FROM appointments WHERE appointment_id=?',[p.data.appointmentId]);const a=rows[0];
  if(!a||Number(a.patient_id)!==p.data.patientId||a.status!=='COMPLETED')return NextResponse.json({error:'Appointment and patient details do not match.'},{status:400});
  if(user.role==='DOCTOR'){const [d]=await db().execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);if(!d[0]||Number(d[0].doctor_id)!==Number(a.doctor_id))return NextResponse.json({error:'You cannot prescribe for another doctor’s appointment.'},{status:403});}
  const [r]=await db().execute<any>('INSERT INTO prescriptions(appointment_id,doctor_id,patient_id,diagnosis_notes,medication_name,dosage,instructions) VALUES(?,?,?,?,?,?,?)',[p.data.appointmentId,a.doctor_id,p.data.patientId,p.data.diagnosisNotes||null,p.data.medicationName,p.data.dosage||null,p.data.instructions||null]);
  return NextResponse.json({prescriptionId:Number(r.insertId)},{status:201});
 }catch(e){return serverError(e);}
}
