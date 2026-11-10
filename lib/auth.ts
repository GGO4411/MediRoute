import { SignJWT,jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest,NextResponse } from 'next/server';
import { db,DBRow } from '@/lib/db';
const COOKIE='mediroute_session';
function secret(){const value=process.env.AUTH_SECRET;if(!value||value.length<32)throw new Error('AUTH_SECRET must be set to at least 32 characters.');return new TextEncoder().encode(value);}
export type SessionUser={userId:number;name:string;email:string;role:'PATIENT'|'DOCTOR'|'ADMIN'};
export async function createSession(user:SessionUser){
 const token=await new SignJWT({...user}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('7d').sign(secret());
 (await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});
}
export async function getSession(req?:NextRequest):Promise<SessionUser|null>{
 try{const token=req?req.cookies.get(COOKIE)?.value:(await cookies()).get(COOKIE)?.value;if(!token)return null;
  const {payload}=await jwtVerify(token,secret());if(!payload.userId||!payload.role)return null;
  return {userId:Number(payload.userId),name:String(payload.name),email:String(payload.email),role:payload.role as SessionUser['role']};
 }catch{return null;}
}
export function unauthorized(){return NextResponse.json({error:'Authentication required.'},{status:401});}
export function forbidden(){return NextResponse.json({error:'You do not have permission to perform this action.'},{status:403});}


/** Resolve protected-operation permissions from the live MySQL role matrix. */
export async function hasPermission(userId:number,permissionCode:string):Promise<boolean>{
 const [rows]=await db().execute<DBRow[]>(`SELECT 1 AS allowed
  FROM users u
  JOIN role_permissions rp ON rp.role_code=u.role
  JOIN permissions p ON p.permission_code=rp.permission_code
  WHERE u.user_id=? AND p.permission_code=? LIMIT 1`,[userId,permissionCode]);
 return rows.length>0;
}
