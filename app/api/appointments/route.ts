import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { db,DBRow } from '@/lib/db';
import { serverError } from '@/lib/http';
const schema=z.object({slotId:z.number().int().positive(),triageId:z.number().int().positive().optional(),reason:z.string().max(1500).optional()});
const finalStates=['CANCELLED','COMPLETED','NO_SHOW'];
export async function GET(req:NextRequest){
 try{
  const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  let sql='SELECT * FROM v_appointment_details';let args:number[]=[];
  if(user.role==='PATIENT'){sql+=' WHERE patient_id=?';args=[user.userId];}
  else if(user.role==='DOCTOR'){const [d]=await db().execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);if(!d[0])return NextResponse.json({appointments:[]});sql+=' WHERE doctor_id=?';args=[Number(d[0].doctor_id)];}
  sql+=' ORDER BY starts_at DESC LIMIT 100';const [rows]=await db().execute<DBRow[]>(sql,args);return NextResponse.json({appointments:rows});
 }catch(e){return serverError(e);}
}
export async function POST(req:NextRequest){
 const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
 if(user.role!=='PATIENT')return NextResponse.json({error:'Only patients can book appointments.'},{status:403});
 const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:'Provide a valid slot.'},{status:400});
 const conn=await db().getConnection();
 try{
  await conn.beginTransaction();
  const [slots]=await conn.execute<DBRow[]>(`SELECT s.slot_id,s.doctor_id,s.status,s.starts_at,d.is_accepting_patients
    FROM appointment_slots s JOIN doctors d ON d.doctor_id=s.doctor_id
    WHERE s.slot_id=? AND s.starts_at>UTC_TIMESTAMP() FOR UPDATE`,[p.data.slotId]);
  const slot=slots[0];
  if(!slot||slot.status!=='AVAILABLE'||!slot.is_accepting_patients){await conn.rollback();return NextResponse.json({error:'This slot is no longer available. Choose another.'},{status:409});}
  let urgency='ROUTINE';
  if(p.data.triageId){
   const [triages]=await conn.execute<DBRow[]>('SELECT urgency FROM triage_sessions WHERE triage_id=? AND patient_id=?',[p.data.triageId,user.userId]);
   if(!triages[0]){await conn.rollback();return NextResponse.json({error:'Triage session not found.'},{status:404});}
   urgency=triages[0].urgency;
   if(urgency==='EMERGENCY'){await conn.rollback();return NextResponse.json({error:'This triage was flagged as a possible emergency. Online appointment booking is paused; seek immediate in-person medical help.'},{status:409});}
  }
  const [r]=await conn.execute<any>('INSERT INTO appointments(patient_id,doctor_id,slot_id,triage_id,urgency,reason) VALUES(?,?,?,?,?,?)',[user.userId,slot.doctor_id,p.data.slotId,p.data.triageId||null,urgency,p.data.reason||null]);
  await conn.commit();return NextResponse.json({appointmentId:Number(r.insertId),message:'Appointment booked successfully.'},{status:201});
 }catch(e:any){
  await conn.rollback();
  if(e?.code==='ER_DUP_ENTRY'||e?.sqlState==='45000')return NextResponse.json({error:'The slot is no longer available. Refresh and select another.'},{status:409});
  return serverError(e);
 }finally{conn.release();}
}
export async function PATCH(req:NextRequest){
 try{
  const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  const p=z.object({appointmentId:z.number().int().positive(),status:z.enum(['CONFIRMED','COMPLETED','CANCELLED','NO_SHOW'])}).safeParse(await req.json());
  if(!p.success)return NextResponse.json({error:'Invalid appointment update.'},{status:400});
  const [rows]=await db().execute<DBRow[]>('SELECT appointment_id,patient_id,doctor_id,status FROM appointments WHERE appointment_id=?',[p.data.appointmentId]);
  const a=rows[0];if(!a)return NextResponse.json({error:'Appointment not found.'},{status:404});
  const current=String(a.status),next=p.data.status;
  if(finalStates.includes(current))return NextResponse.json({error:'This appointment is already closed and cannot be reopened.'},{status:409});
  if(user.role==='PATIENT'){
   if(Number(a.patient_id)!==user.userId||next!=='CANCELLED')return NextResponse.json({error:'Patients may only cancel their own active appointments.'},{status:403});
  }else if(user.role==='DOCTOR'){
   const [d]=await db().execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);
   if(!d[0]||Number(d[0].doctor_id)!==Number(a.doctor_id))return NextResponse.json({error:'This appointment is not assigned to you.'},{status:403});
   if(!['COMPLETED','NO_SHOW'].includes(next)||current!=='CONFIRMED')return NextResponse.json({error:'Doctors can complete or mark no-show only for confirmed appointments.'},{status:409});
  }else if(user.role==='ADMIN'){
   if(!['CONFIRMED','CANCELLED','NO_SHOW'].includes(next))return NextResponse.json({error:'Administrators can confirm, cancel or mark active bookings as no-show.'},{status:403});
   if(next==='CONFIRMED'&&current!=='BOOKED')return NextResponse.json({error:'Only booked appointments can be confirmed.'},{status:409});
  }else return NextResponse.json({error:'Forbidden.'},{status:403});
  if(next==='CANCELLED'&&!['BOOKED','CONFIRMED'].includes(current))return NextResponse.json({error:'Only an active appointment can be cancelled.'},{status:409});
  await db().execute('UPDATE appointments SET status=? WHERE appointment_id=?',[next,p.data.appointmentId]);
  return NextResponse.json({message:'Appointment status updated.'});
 }catch(e){return serverError(e);}
}
