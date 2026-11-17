import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession,hasPermission } from '@/lib/auth';
import { db,DBRow } from '@/lib/db';
import { readJsonBody,serverError,validationError } from '@/lib/http';
import { hasMysqlError,hasMysqlSqlState } from '@/lib/mysql-errors';
import type { ResultSetHeader } from 'mysql2';
const schema=z.object({slotId:z.number().int().positive(),triageId:z.number().int().positive().optional(),reason:z.string().max(1500).optional()});
const finalStates=['CANCELLED','COMPLETED','NO_SHOW'];
const dateOnlySchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value)=>{
 const date=new Date(`${value}T00:00:00.000Z`);
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
},{message:'Use a valid calendar date in YYYY-MM-DD format.'});
const appointmentFilterSchema=z.object({
 filter:z.enum(['ALL','UPCOMING','PAST','BOOKED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW']).optional(),
 status:z.enum(['ALL','UPCOMING','PAST','BOOKED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW']).optional(),
 doctorId:z.coerce.number().int().positive().optional(),
 dateFrom:dateOnlySchema.optional(),
 dateTo:dateOnlySchema.optional()
}).refine(v=>!v.dateFrom||!v.dateTo||v.dateFrom<=v.dateTo,{path:['dateTo'],message:'End date must be on or after start date.'});
export async function GET(req:NextRequest){
 try{
  const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  const page=Number(req.nextUrl.searchParams.get('page')||1),pageSize=Number(req.nextUrl.searchParams.get('pageSize')||100);
  if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100||(page-1)*pageSize>Number.MAX_SAFE_INTEGER)return NextResponse.json({error:'Page must be positive and pageSize must be between 1 and 100.'},{status:400});
  const params=Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed=appointmentFilterSchema.safeParse(params);if(!parsed.success)return validationError(parsed.error,'Invalid appointment filters.');
  const filter=parsed.data.filter||parsed.data.status||'ALL';
  const conditions:string[]=[];const args:(string|number)[]=[];
  if(user.role==='PATIENT'){if(!(await hasPermission(user.userId,'APPOINTMENT_READ_OWN')))return NextResponse.json({error:'Database permission denied.'},{status:403});conditions.push('patient_id=?');args.push(user.userId);}
  else if(user.role==='DOCTOR'){if(!(await hasPermission(user.userId,'APPOINTMENT_READ_ASSIGNED')))return NextResponse.json({error:'Database permission denied.'},{status:403});const [d]=await db().execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);if(!d[0])return NextResponse.json({appointments:[],pagination:{page,pageSize,total:0,hasMore:false}});conditions.push('doctor_id=?');args.push(Number(d[0].doctor_id));}
  else if(user.role==='ADMIN'&&!(await hasPermission(user.userId,'APPOINTMENT_READ_ALL')))return NextResponse.json({error:'Database permission denied.'},{status:403});
  if(parsed.data.doctorId!==undefined){
   if(user.role==='DOCTOR'){
    const [doctorRows]=await db().execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);
    if(!doctorRows[0]||Number(doctorRows[0].doctor_id)!==parsed.data.doctorId)return NextResponse.json({error:'You may only filter appointments assigned to you.'},{status:403});
   }
   conditions.push('doctor_id=?');args.push(parsed.data.doctorId);
  }
  if(parsed.data.dateFrom){conditions.push('starts_at>=?');args.push(`${parsed.data.dateFrom} 00:00:00`);}
  if(parsed.data.dateTo){conditions.push('starts_at<DATE_ADD(?, INTERVAL 1 DAY)');args.push(`${parsed.data.dateTo} 00:00:00`);}
  if(filter==='UPCOMING')conditions.push("status IN ('BOOKED','CONFIRMED') AND starts_at>UTC_TIMESTAMP()");
  else if(filter==='PAST')conditions.push('starts_at<=UTC_TIMESTAMP()');
  else if(filter!=='ALL'){conditions.push('status=?');args.push(filter);}
  const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
  const [countRows]=await db().execute<DBRow[]>(`SELECT COUNT(*) AS total FROM v_appointment_details${where}`,args);
  const total=Number(countRows[0]?.total||0),offset=(page-1)*pageSize;
  const [rows]=await db().execute<DBRow[]>(`SELECT * FROM v_appointment_details${where} ORDER BY starts_at DESC,appointment_id DESC LIMIT ? OFFSET ?`,[...args,pageSize,offset]);
  const ids=rows.map(r=>Number(r.appointment_id));
  if(ids.length){
   const marks=ids.map(()=>'?').join(',');
   const [statusEvents]=await db().execute<DBRow[]>(`SELECT appointment_id,action,old_status,new_status,changed_at,NULL AS old_slot_id,NULL AS new_slot_id FROM appointment_audit WHERE appointment_id IN (${marks})`,ids);
   const [moveEvents]=await db().execute<DBRow[]>(`SELECT h.appointment_id,'RESCHEDULED' AS action,NULL AS old_status,NULL AS new_status,h.changed_at,h.old_slot_id,h.new_slot_id,old_slot.starts_at AS old_starts_at,new_slot.starts_at AS new_starts_at FROM appointment_reschedule_audit h JOIN appointment_slots old_slot ON old_slot.slot_id=h.old_slot_id JOIN appointment_slots new_slot ON new_slot.slot_id=h.new_slot_id WHERE h.appointment_id IN (${marks})`,ids);
   const history=[...statusEvents,...moveEvents];
   for(const row of rows)row.history=history.filter(event=>Number(event.appointment_id)===Number(row.appointment_id)).sort((a,b)=>new Date(a.changed_at).getTime()-new Date(b.changed_at).getTime());
  }
  return NextResponse.json({appointments:rows,pagination:{page,pageSize,total,hasMore:offset+rows.length<total}});
 }catch(e){return serverError(e);}
}
export async function POST(req:NextRequest){
 const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
 if(!(await hasPermission(user.userId,'APPOINTMENT_BOOK')))return NextResponse.json({error:'Your database role cannot book appointments.'},{status:403});
 const body=await readJsonBody(req);if(!body.ok)return body.response;const p=schema.safeParse(body.value);if(!p.success)return validationError(p.error,'Provide a valid slot.');
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
  const [r]=await conn.execute<ResultSetHeader>('INSERT INTO appointments(patient_id,doctor_id,slot_id,triage_id,urgency,reason) VALUES(?,?,?,?,?,?)',[user.userId,slot.doctor_id,p.data.slotId,p.data.triageId||null,urgency,p.data.reason||null]);
  await conn.commit();return NextResponse.json({appointmentId:Number(r.insertId),message:'Appointment booked successfully.'},{status:201});
 }catch(e:unknown){
  await conn.rollback();
  if(hasMysqlError(e,'ER_DUP_ENTRY')||hasMysqlSqlState(e,'45000'))return NextResponse.json({error:'The slot is no longer available. Refresh and select another.'},{status:409});
  return serverError(e);
 }finally{conn.release();}
}
export async function PATCH(req:NextRequest){
 try{
  const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  const body=await readJsonBody(req);if(!body.ok)return body.response;const p=z.object({appointmentId:z.number().int().positive(),status:z.enum(['CONFIRMED','COMPLETED','CANCELLED','NO_SHOW'])}).safeParse(body.value);
  if(!p.success)return validationError(p.error,'Invalid appointment update.');
  const permission=user.role==='PATIENT'?'APPOINTMENT_CANCEL_OWN':user.role==='DOCTOR'?'APPOINTMENT_COMPLETE_ASSIGNED':user.role==='ADMIN'?'APPOINTMENT_MANAGE_ALL':'';
  if(!permission)return NextResponse.json({error:'Forbidden.'},{status:403});
  if(!(await hasPermission(user.userId,permission)))return NextResponse.json({error:'Database permission denied.'},{status:403});
  const conn=await db().getConnection();
  try{
   await conn.beginTransaction();
   const [rows]=await conn.execute<DBRow[]>('SELECT appointment_id,patient_id,doctor_id,status FROM appointments WHERE appointment_id=? FOR UPDATE',[p.data.appointmentId]);
   const a=rows[0];if(!a){await conn.rollback();return NextResponse.json({error:'Appointment not found.'},{status:404});}
   const current=String(a.status),next=p.data.status;
   if(finalStates.includes(current)){await conn.rollback();return NextResponse.json({error:'This appointment is already closed and cannot be reopened.'},{status:409});}
   if(user.role==='PATIENT'){
    if(Number(a.patient_id)!==user.userId||next!=='CANCELLED'){await conn.rollback();return NextResponse.json({error:'Patients may only cancel their own active appointments.'},{status:403});}
   }else if(user.role==='DOCTOR'){
    const [d]=await conn.execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);
    if(!d[0]||Number(d[0].doctor_id)!==Number(a.doctor_id)){await conn.rollback();return NextResponse.json({error:'This appointment is not assigned to you.'},{status:403});}
    if(!['COMPLETED','NO_SHOW'].includes(next)||current!=='CONFIRMED'){await conn.rollback();return NextResponse.json({error:'Doctors can complete or mark no-show only for confirmed appointments.'},{status:409});}
   }else if(user.role==='ADMIN'){
    if(!['CONFIRMED','CANCELLED','NO_SHOW'].includes(next)){await conn.rollback();return NextResponse.json({error:'Administrators can confirm, cancel or mark active bookings as no-show.'},{status:403});}
    if(next==='CONFIRMED'&&current!=='BOOKED'){await conn.rollback();return NextResponse.json({error:'Only booked appointments can be confirmed.'},{status:409});}
   }else{await conn.rollback();return NextResponse.json({error:'Forbidden.'},{status:403});}
   if(next==='CANCELLED'&&!['BOOKED','CONFIRMED'].includes(current)){await conn.rollback();return NextResponse.json({error:'Only an active appointment can be cancelled.'},{status:409});}
   const [update]=await conn.execute<ResultSetHeader>('UPDATE appointments SET status=? WHERE appointment_id=? AND status=?',[next,p.data.appointmentId,current]);
   if(update.affectedRows!==1){await conn.rollback();return NextResponse.json({error:'Appointment status changed concurrently. Refresh and try again.'},{status:409});}
   await conn.commit();return NextResponse.json({message:'Appointment status updated.'});
  }catch(e:unknown){await conn.rollback();if(hasMysqlSqlState(e,'45000')||hasMysqlError(e,'ER_LOCK_DEADLOCK')||hasMysqlError(e,'ER_LOCK_WAIT_TIMEOUT'))return NextResponse.json({error:'This appointment status transition conflicts with its current state. Refresh and try again.'},{status:409});return serverError(e);}
  finally{conn.release();}
 }catch(e){return serverError(e);}
}
