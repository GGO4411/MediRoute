import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { db,DBRow } from '@/lib/db';
import { serverError } from '@/lib/http';
const schema=z.object({doctorId:z.coerce.number().int().positive()});
export async function GET(req:NextRequest){try{const p=schema.safeParse({doctorId:req.nextUrl.searchParams.get('doctorId')});if(!p.success)return NextResponse.json({error:'A valid doctorId is required.'},{status:400});
 const [rows]=await db().execute<DBRow[]>("SELECT slot_id AS slotId,starts_at AS startsAt,ends_at AS endsAt FROM appointment_slots WHERE doctor_id=? AND status='AVAILABLE' AND starts_at>NOW() ORDER BY starts_at LIMIT 50",[p.data.doctorId]);return NextResponse.json({slots:rows});
 }catch(e){return serverError(e);}}
