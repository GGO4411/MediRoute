import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession,hasPermission } from '@/lib/auth';
import { db,DBRow } from '@/lib/db';
import { serverError } from '@/lib/http';
const querySchema=z.object({doctorId:z.coerce.number().int().positive()});
const createSchema=z.object({startsAt:z.string().datetime({offset:true}),endsAt:z.string().datetime({offset:true})});
const mysqlDate=(date:Date)=>date.toISOString().slice(0,19).replace('T',' ');
export async function GET(req:NextRequest){
 try{
  const mine=req.nextUrl.searchParams.get('mine')==='1';
  if(mine){
   const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
   const permission=user.role==='DOCTOR'?'SLOT_MANAGE_OWN':user.role==='ADMIN'?'SLOT_MANAGE_ALL':'';
   if(!permission||!(await hasPermission(user.userId,permission)))return NextResponse.json({error:'Database permission denied.'},{status:403});
   let sql=`SELECT s.slot_id AS slotId,d.doctor_id AS doctorId,u.full_name AS doctorName,s.starts_at AS startsAt,s.ends_at AS endsAt
    FROM appointment_slots s JOIN doctors d ON d.doctor_id=s.doctor_id JOIN users u ON u.user_id=d.user_id
    WHERE s.status='AVAILABLE' AND s.starts_at>UTC_TIMESTAMP()`;
   let args:number[]=[];
   if(user.role==='DOCTOR'){
    const [d]=await db().execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);
    if(!d[0])return NextResponse.json({slots:[]});
    sql+=' AND d.doctor_id=?';args=[Number(d[0].doctor_id)];
   }
   sql+=' ORDER BY s.starts_at LIMIT 100';
   const [rows]=await db().execute<DBRow[]>(sql,args);return NextResponse.json({slots:rows});
  }
  const p=querySchema.safeParse({doctorId:req.nextUrl.searchParams.get('doctorId')});
  if(!p.success)return NextResponse.json({error:'A valid doctorId is required.'},{status:400});
  const [rows]=await db().execute<DBRow[]>(`SELECT slot_id AS slotId,starts_at AS startsAt,ends_at AS endsAt
   FROM appointment_slots WHERE doctor_id=? AND status='AVAILABLE' AND starts_at>UTC_TIMESTAMP() ORDER BY starts_at LIMIT 50`,[p.data.doctorId]);
  return NextResponse.json({slots:rows});
 }catch(e){return serverError(e);}
}
export async function POST(req:NextRequest){
 try{
  const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  if(user.role!=='DOCTOR'||!(await hasPermission(user.userId,'SLOT_MANAGE_OWN')))return NextResponse.json({error:'Your database role cannot create this availability.'},{status:403});
  const p=createSchema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:'Provide valid ISO start and end timestamps.'},{status:400});
  const start=new Date(p.data.startsAt),end=new Date(p.data.endsAt),duration=(end.getTime()-start.getTime())/60000;
  if(!Number.isFinite(duration)||start.getTime()<=Date.now()||duration<15||duration>180||start.getTime()>Date.now()+90*86400000)
   return NextResponse.json({error:'Slots must be in the future, within 90 days, and last 15 to 180 minutes.'},{status:400});
  const conn=await db().getConnection();
  try{
   await conn.beginTransaction();
   const [docs]=await conn.execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=? FOR UPDATE',[user.userId]);
   if(!docs[0]){await conn.rollback();return NextResponse.json({error:'This account is not linked to a doctor profile.'},{status:403});}
   const doctorId=Number(docs[0].doctor_id);
   const [overlaps]=await conn.execute<DBRow[]>(`SELECT slot_id FROM appointment_slots
    WHERE doctor_id=? AND status<>'BLOCKED' AND starts_at<? AND ends_at>? FOR UPDATE`,[doctorId,mysqlDate(end),mysqlDate(start)]);
   if(overlaps.length){await conn.rollback();return NextResponse.json({error:'This time overlaps an existing available or booked slot.'},{status:409});}
   const [r]=await conn.execute<any>('INSERT INTO appointment_slots(doctor_id,starts_at,ends_at,status) VALUES(?,?,? ,\'AVAILABLE\')',[doctorId,mysqlDate(start),mysqlDate(end)]);
   await conn.commit();return NextResponse.json({slotId:Number(r.insertId),message:'Availability added.'},{status:201});
  }catch(e:any){await conn.rollback();if(e?.code==='ER_DUP_ENTRY')return NextResponse.json({error:'A slot already starts at this time.'},{status:409});return serverError(e);}
  finally{conn.release();}
 }catch(e){return serverError(e);}
}
export async function DELETE(req:NextRequest){
 const user=await getSession(req);if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
 const deletePermission=user.role==='DOCTOR'?'SLOT_MANAGE_OWN':user.role==='ADMIN'?'SLOT_MANAGE_ALL':'';
 if(!deletePermission||!(await hasPermission(user.userId,deletePermission)))return NextResponse.json({error:'Database permission denied.'},{status:403});
 const slotId=Number(req.nextUrl.searchParams.get('slotId'));if(!Number.isSafeInteger(slotId)||slotId<=0)return NextResponse.json({error:'A valid slotId is required.'},{status:400});
 const conn=await db().getConnection();
 try{
  await conn.beginTransaction();
  const [rows]=await conn.execute<DBRow[]>('SELECT slot_id,doctor_id,status,starts_at FROM appointment_slots WHERE slot_id=? FOR UPDATE',[slotId]);
  const slot=rows[0];if(!slot){await conn.rollback();return NextResponse.json({error:'Slot not found.'},{status:404});}
  if(user.role==='DOCTOR'){
   const [d]=await conn.execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE user_id=?',[user.userId]);
   if(!d[0]||Number(d[0].doctor_id)!==Number(slot.doctor_id)){await conn.rollback();return NextResponse.json({error:'You cannot remove another doctor’s slot.'},{status:403});}
  }
  if(slot.status!=='AVAILABLE'){await conn.rollback();return NextResponse.json({error:'Only unused available slots can be removed.'},{status:409});}
  const [r]=await conn.execute<any>(`DELETE FROM appointment_slots
   WHERE slot_id=? AND status='AVAILABLE' AND starts_at>UTC_TIMESTAMP()
   AND NOT EXISTS(SELECT 1 FROM appointments a WHERE a.slot_id=appointment_slots.slot_id)`,[slotId]);
  if(r.affectedRows!==1){await conn.rollback();return NextResponse.json({error:'This slot is in the past or has appointment history and cannot be removed.'},{status:409});}
  await conn.commit();return NextResponse.json({message:'Available slot removed.'});
 }catch(e){await conn.rollback();return serverError(e);}finally{conn.release();}
}
