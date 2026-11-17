import { NextRequest,NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { readJsonBody,serverError,validationError } from '@/lib/http';
import { hasMysqlError } from '@/lib/mysql-errors';
import type { ResultSetHeader } from 'mysql2';
import { strongPasswordSchema } from '@/lib/password-policy';
const schema=z.object({name:z.string().min(2).max(120),email:z.string().email().max(190),password:strongPasswordSchema,phone:z.string().max(20).optional()});
export async function POST(req:NextRequest){
 try{const body=await readJsonBody(req);if(!body.ok)return body.response;const p=schema.safeParse(body.value);if(!p.success)return validationError(p.error,'Enter valid account details.');
  const {name,email,password,phone}=p.data,hash=await bcrypt.hash(password,12);
  const [r]=await db().execute<ResultSetHeader>("INSERT INTO users(full_name,email,password_hash,role,phone) VALUES(?,?,?,'PATIENT',?)",[name,email.toLowerCase(),hash,phone||null]);
  const user={userId:Number(r.insertId),name,email:email.toLowerCase(),role:'PATIENT' as const};await createSession(user);
  return NextResponse.json({user},{status:201});
 }catch(e:unknown){if(hasMysqlError(e,'ER_DUP_ENTRY'))return NextResponse.json({error:'An account with this email already exists.'},{status:409});return serverError(e);}
}
