import { NextRequest,NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSession,hasPermission,type SessionUser } from '@/lib/auth';
import { db,DBRow } from '@/lib/db';
import { serverError } from '@/lib/http';

const createSchema=z.object({
 name:z.string().min(2).max(120),
 email:z.string().email().max(190),
 password:z.string().min(8).max(72),
 specialty:z.string().min(2).max(100),
 qualification:z.string().min(2).max(180),
 yearsExperience:z.number().int().min(0).max(70),
 consultationFee:z.number().min(0).max(1000000),
 bio:z.string().max(3000).optional()
});
const updateSchema=z.object({
 doctorId:z.number().int().positive(),
 isAcceptingPatients:z.boolean().optional(),
 specialty:z.string().min(2).max(100).optional(),
 qualification:z.string().min(2).max(180).optional(),
 yearsExperience:z.number().int().min(0).max(70).optional(),
 consultationFee:z.number().min(0).max(1000000).optional(),
 bio:z.string().max(3000).optional()
});

async function requireAdmin(req:NextRequest):Promise<{user?:SessionUser;response?:NextResponse}>{
 const user=await getSession(req);
 if(!user)return {response:NextResponse.json({error:'Authentication required.'},{status:401})};
 if(!(await hasPermission(user.userId,'DOCTOR_MANAGE')))return {response:NextResponse.json({error:'Database permission denied.'},{status:403})};
 return {user};
}
export async function GET(req:NextRequest){
 try{
  const auth=await requireAdmin(req);if(auth.response)return auth.response;
  const [rows]=await db().query<DBRow[]>(`SELECT doctor_id,user_id,doctor_name,email,specialty,qualification,
   years_experience,consultation_fee,bio,is_accepting_patients FROM
   (SELECT d.doctor_id,d.user_id,u.full_name AS doctor_name,u.email,s.name AS specialty,d.qualification,
    d.years_experience,d.consultation_fee,d.bio,d.is_accepting_patients
    FROM doctors d JOIN users u ON u.user_id=d.user_id JOIN specialties s ON s.specialty_id=d.specialty_id) directory
   ORDER BY specialty,doctor_name`);
  return NextResponse.json({doctors:rows});
 }catch(e){return serverError(e);}
}
export async function POST(req:NextRequest){
 const auth=await requireAdmin(req);if(auth.response)return auth.response;
 const parsed=createSchema.safeParse(await req.json());
 if(!parsed.success)return NextResponse.json({error:'Provide valid doctor, login and specialty details.'},{status:400});
 const p=parsed.data,conn=await db().getConnection();
 try{
  await conn.beginTransaction();
  const hash=await bcrypt.hash(p.password,12);
  const [userResult]:any=await conn.execute("INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,'DOCTOR')",[p.name,p.email.toLowerCase(),hash]);
  await conn.execute('INSERT IGNORE INTO specialties(name,description) VALUES(?,?)',[p.specialty, 'Clinical specialty: '+p.specialty]);
  const [specs]=await conn.execute<DBRow[]>('SELECT specialty_id FROM specialties WHERE name=? FOR UPDATE',[p.specialty]);
  if(!specs[0])throw new Error('Unable to create or locate specialty.');
  const [doctorResult]:any=await conn.execute('INSERT INTO doctors(user_id,specialty_id,qualification,years_experience,consultation_fee,bio) VALUES(?,?,?,?,?,?)',[userResult.insertId,specs[0].specialty_id,p.qualification,p.yearsExperience,p.consultationFee,p.bio||null]);
  await conn.commit();
  return NextResponse.json({doctorId:Number(doctorResult.insertId),message:'Doctor profile created.'},{status:201});
 }catch(e:any){
  await conn.rollback();
  if(e?.code==='ER_DUP_ENTRY')return NextResponse.json({error:'A user with this email already exists.'},{status:409});
  return serverError(e);
 }finally{conn.release();}
}
export async function PATCH(req:NextRequest){
 const auth=await requireAdmin(req);if(auth.response)return auth.response;
 const parsed=updateSchema.safeParse(await req.json());
 if(!parsed.success)return NextResponse.json({error:'Provide valid doctor update fields.'},{status:400});
 const {doctorId,...fields}=parsed.data;
 if(!Object.keys(fields).length)return NextResponse.json({error:'No update fields supplied.'},{status:400});
 const conn=await db().getConnection();
 try{
  await conn.beginTransaction();
  const [doctors]=await conn.execute<DBRow[]>('SELECT doctor_id FROM doctors WHERE doctor_id=? FOR UPDATE',[doctorId]);
  if(!doctors[0]){await conn.rollback();return NextResponse.json({error:'Doctor not found.'},{status:404});}
  if(fields.specialty){
   await conn.execute('INSERT IGNORE INTO specialties(name,description) VALUES(?,?)',[fields.specialty,'Clinical specialty: '+fields.specialty]);
   const [s]=await conn.execute<DBRow[]>('SELECT specialty_id FROM specialties WHERE name=?',[fields.specialty]);
   await conn.execute('UPDATE doctors SET specialty_id=? WHERE doctor_id=?',[s[0].specialty_id,doctorId]);
  }
  const columns:Array<[keyof typeof fields,string]>=[
   ['isAcceptingPatients','is_accepting_patients'],['qualification','qualification'],
   ['yearsExperience','years_experience'],['consultationFee','consultation_fee'],['bio','bio']
  ];
  const updates=columns.filter(([key])=>fields[key]!==undefined);
  if(updates.length){
   const sql='UPDATE doctors SET '+updates.map(([,column])=>'`'+column+'`=?').join(',')+' WHERE doctor_id=?';
   const params:(string|number|boolean)[]=updates.map(([key])=>fields[key] as string|number|boolean);
   params.push(doctorId);
   await conn.execute(sql,params);
  }
  await conn.commit();return NextResponse.json({message:'Doctor directory updated.'});
 }catch(e){await conn.rollback();return serverError(e);}finally{conn.release();}
}
