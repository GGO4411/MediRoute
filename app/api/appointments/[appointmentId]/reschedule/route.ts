import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession,hasPermission } from '@/lib/auth';
import { db,DBRow } from '@/lib/db';
import { serverError } from '@/lib/http';
import type { ResultSetHeader } from 'mysql2';

const schema=z.object({slotId:z.number().int().positive()});

export async function POST(req:NextRequest,{params}:{params:Promise<{appointmentId:string}>}){
 const user=await getSession(req);
 if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
 if(user.role!=='PATIENT'||!(await hasPermission(user.userId,'APPOINTMENT_RESCHEDULE_OWN')))
  return NextResponse.json({error:'Patients with rescheduling permission may change their own appointments.'},{status:403});
 const {appointmentId:rawId}=await params,appointmentId=Number(rawId);
 if(!Number.isSafeInteger(appointmentId)||appointmentId<=0)return NextResponse.json({error:'A valid appointmentId is required.'},{status:400});
 let payload:unknown;
 try{payload=await req.json();}catch{return NextResponse.json({error:'Provide a valid future slot.'},{status:400});}
 const parsed=schema.safeParse(payload);
 if(!parsed.success)return NextResponse.json({error:'Provide a valid future slot.'},{status:400});
 const conn=await db().getConnection();
 try{
  await conn.beginTransaction();
  const [appointments]=await conn.execute<DBRow[]>(
   'SELECT appointment_id,patient_id,doctor_id,slot_id,status FROM appointments WHERE appointment_id=? FOR UPDATE',[appointmentId]);
  const appointment=appointments[0];
  if(!appointment){await conn.rollback();return NextResponse.json({error:'Appointment not found.'},{status:404});}
  if(Number(appointment.patient_id)!==user.userId){await conn.rollback();return NextResponse.json({error:'You may only reschedule your own appointment.'},{status:403});}
  if(!['BOOKED','CONFIRMED'].includes(String(appointment.status))){await conn.rollback();return NextResponse.json({error:'Only active appointments can be rescheduled.'},{status:409});}
  const oldSlotId=Number(appointment.slot_id),newSlotId=parsed.data.slotId;
  if(oldSlotId===newSlotId){await conn.rollback();return NextResponse.json({error:'Choose a different slot.'},{status:400});}
  // Lock slots in a stable order so overlapping reschedules acquire locks consistently.
  const ids=[oldSlotId,newSlotId].sort((a,b)=>a-b);
  const [slots]=await conn.execute<DBRow[]>(
   `SELECT slot_id,doctor_id,status,starts_at,(starts_at>UTC_TIMESTAMP()) AS is_future FROM appointment_slots
    WHERE slot_id IN (?,?) ORDER BY slot_id FOR UPDATE`,ids);
  const oldSlot=slots.find(s=>Number(s.slot_id)===oldSlotId);
  const newSlot=slots.find(s=>Number(s.slot_id)===newSlotId);
  if(!oldSlot||oldSlot.status!=='BOOKED'||!oldSlot.is_future){await conn.rollback();return NextResponse.json({error:'Only an active future appointment can be rescheduled.'},{status:409});}
  if(!newSlot||Number(newSlot.doctor_id)!==Number(appointment.doctor_id)||newSlot.status!=='AVAILABLE'||!newSlot.is_future){
   await conn.rollback();return NextResponse.json({error:'Choose an available future slot belonging to the same doctor.'},{status:409});
  }
  const [update]=await conn.execute<ResultSetHeader>(`UPDATE appointment_slots SET status='AVAILABLE' WHERE slot_id=? AND status='BOOKED'`,[oldSlotId]);
  if(update.affectedRows!==1)throw new Error('Could not release the current slot.');
  const [reserve]=await conn.execute<ResultSetHeader>(`UPDATE appointment_slots SET status='BOOKED' WHERE slot_id=? AND status='AVAILABLE'`,[newSlotId]);
  if(reserve.affectedRows!==1)throw new Error('The selected slot was taken.');
  const [move]=await conn.execute<ResultSetHeader>(`UPDATE appointments SET slot_id=? WHERE appointment_id=? AND slot_id=? AND status IN ('BOOKED','CONFIRMED')`,[newSlotId,appointmentId,oldSlotId]);
  if(move.affectedRows!==1)throw new Error('Appointment changed while rescheduling.');
  await conn.execute(`INSERT INTO appointment_reschedule_audit(appointment_id,old_slot_id,new_slot_id,changed_by) VALUES(?,?,?,?)`,[appointmentId,oldSlotId,newSlotId,user.userId]);
  await conn.commit();
  return NextResponse.json({message:'Appointment rescheduled successfully.'});
 }catch(e){await conn.rollback();return serverError(e);}
 finally{conn.release();}
}
