import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { db,DBRow } from '@/lib/db';
import { serverError } from '@/lib/http';
const schema=z.object({slotId:z.number().int().positive(),triageId:z.number().int().positive().optional(),reason:z.string().max(1500).optional()});
export async function GET(req:NextRequest){
 try{const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});let sql='SELECT * FROM v_appointment_details';let args:number[]=[];
  if(user.role==='PATIENT'){sql+=' WHERE patient_id=?';args=[user.userId];}
  else if(user.role==='DOCTOR'){const [d]=await db().execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);if(!d[0])return NextResponse.json({appointments:[]});sql+=' WHERE doctor_id=?';args=[Number(d[0].doctor_id)];}
  sql+=' ORDER BY starts_at DESC LIMIT 100';const [rows]=await db().execute<DBRow[]>(sql,args);return NextResponse.json({appointments:rows});
 }catch(e){return serverError(e);}
}
export async function POST(req:NextRequest){
 const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});if(user.role!=='PATIENT')return NextResponse.json({error:'Only patients can book appointments.'},{status:403});
 const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:'Provide a valid slot.'},{status:400});const conn=await db().getConnection();
 try{await conn.beginTransaction();const [slots]=await conn.execute<DBRow[]>('SELECT slot_id,doctor_id,status FROM appointment_slots WHERE slot_id=? FOR UPDATE',[p.data.slotId]);const slot=slots[0];
  if(!slot||slot.status!=='AVAILABLE'){await conn.rollback();return NextResponse.json({error:'This slot has already been booked. Choose another.'},{status:409});}
  let urgency='ROUTINE';if(p.data.triageId){const [t]=await conn.execute<DBRow[]>('SELECT urgency FROM triage_sessions WHERE triage_id=? AND patient_id=?',[p.data.triageId,user.userId]);if(!t[0]){await conn.rollback();return NextResponse.json({error:'Triage session not found.'},{status:404});}urgency=t[0].urgency;}
  const [r]=await conn.execute<any>('INSERT INTO appointments(patient_id,doctor_id,slot_id,triage_id,urgency,reason) VALUES(?,?,?,?,?,?)',[user.userId,slot.doctor_id,p.data.slotId,p.data.triageId||null,urgency,p.data.reason||null]);
  await conn.commit();return NextResponse.json({appointmentId:Number(r.insertId),message:'Appointment booked successfully.'},{status:201});
 }catch(e:any){await conn.rollback();if(e?.code==='ER_DUP_ENTRY'||e?.sqlState==='45000')return NextResponse.json({error:'The slot is no longer available. Refresh and select another.'},{status:409});return serverError(e);}finally{conn.release();}
}
export async function PATCH(req:NextRequest){
 try{const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  const p=z.object({appointmentId:z.number().int().positive(),status:z.enum(['CONFIRMED','COMPLETED','CANCELLED','NO_SHOW'])}).safeParse(await req.json());if(!p.success)return NextResponse.json({error:'Invalid appointment update.'},{status:400});
  const [rows]=await db().execute<DBRow[]>('SELECT appointment_id,patient_id,doctor_id,status FROM appointments WHERE appointment_id=?',[p.data.appointmentId]);const a=rows[0];if(!a)return NextResponse.json({error:'Appointment not found.'},{status:404});
  if(user.role==='PATIENT'){if(Number(a.patient_id)!==user.userId||p.data.status!=='CANCELLED'||!['BOOKED','CONFIRMED'].includes(a.status))return NextResponse.json({error:'Patients may only cancel their own appointments.'},{status:403});}
  else if(user.role==='DOCTOR'){const [d]=await db().execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);if(!d[0]||Number(d[0].doctor_id)!==Number(a.doctor_id))return NextResponse.json({error:'This appointment is not assigned to you.'},{status:403});}
  else if(user.role!=='ADMIN')return NextResponse.json({error:'Forbidden.'},{status:403});
  await db().execute('UPDATE appointments SET status=? WHERE appointment_id=?',[p.data.status,p.data.appointmentId]);return NextResponse.json({message:'Appointment status updated.'});
 }catch(e){return serverError(e);}
}
