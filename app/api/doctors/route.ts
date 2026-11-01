import { NextResponse } from 'next/server';
import { db,DBRow } from '@/lib/db';
import { serverError } from '@/lib/http';
export async function GET(){
 try{
  const [rows]=await db().query<DBRow[]>(`SELECT doctor_id,doctor_name,specialty,qualification,years_experience,consultation_fee,bio,is_accepting_patients
   FROM v_doctor_directory WHERE is_accepting_patients=1 ORDER BY specialty,years_experience DESC`);
  return NextResponse.json({doctors:rows});
 }catch(e){return serverError(e);}
}
