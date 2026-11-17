import { NextRequest,NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db,DBRow } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { serverError } from '@/lib/http';
import { clearFailedLogins,loginRateLimitKey,loginRateLimitStatus,recordFailedLogin } from '@/lib/login-rate-limit';
const schema=z.object({email:z.string().email(),password:z.string().min(1)});
export async function POST(req:NextRequest){
 try{const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:'Enter a valid email and password.'},{status:400});
  const [rows]=await db().execute<DBRow[]>('SELECT user_id,full_name,email,password_hash,role FROM users WHERE email=? LIMIT 1',[p.data.email.toLowerCase()]);
  const address=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown';
  const rateLimitKey=loginRateLimitKey(address),status=await loginRateLimitStatus(rateLimitKey);
  if(status.limited)return NextResponse.json({error:'Too many login attempts. Try again later.'},{status:429,headers:{'Retry-After':String(status.retryAfterSeconds)}});
  const u=rows[0];if(!u||!(await bcrypt.compare(p.data.password,u.password_hash))){await recordFailedLogin(rateLimitKey);return NextResponse.json({error:'Incorrect email or password.'},{status:401});}
  await clearFailedLogins(rateLimitKey);
  const user={userId:Number(u.user_id),name:u.full_name,email:u.email,role:u.role};await createSession(user);return NextResponse.json({user});
 }catch(e){return serverError(e);}
}
