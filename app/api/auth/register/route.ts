import { NextRequest,NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { serverError } from '@/lib/http';
const schema=z.object({name:z.string().min(2).max(120),email:z.string().email().max(190),password:z.string().min(8).max(72),phone:z.string().max(20).optional()});
export async function POST(req:NextRequest){
 try{const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:'Enter a valid name, email and password (at least 8 characters).'},{status:400});
  const {name,email,password,phone}=p.data,hash=await bcrypt.hash(password,12);
  const [r]=await db().execute<any>("INSERT INTO users(full_name,email,password_hash,role,phone) VALUES(?,?,?,'PATIENT',?)",[name,email.toLowerCase(),hash,phone||null]);
  const user={userId:Number(r.insertId),name,email:email.toLowerCase(),role:'PATIENT' as const};await createSession(user);
  return NextResponse.json({user},{status:201});
 }catch(e:any){if(e?.code==='ER_DUP_ENTRY')return NextResponse.json({error:'An account with this email already exists.'},{status:409});return serverError(e);}
}
