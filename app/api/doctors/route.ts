import { NextResponse } from 'next/server';
import { db,DBRow } from '@/lib/db';
import { serverError } from '@/lib/http';
export async function GET(){try{const [rows]=await db().query<DBRow[]>('SELECT * FROM v_doctor_directory WHERE is_accepting_patients=1 ORDER BY specialty,years_experience DESC');return NextResponse.json({doctors:rows});}catch(e){return serverError(e);}}
