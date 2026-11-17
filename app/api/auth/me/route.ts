import { NextRequest,NextResponse } from 'next/server';
import { clearSessionCookie,getSession,SESSION_COOKIE_NAME } from '@/lib/auth';
export async function GET(req:NextRequest){const user=await getSession(req);if(!user){const token=req.cookies.get(SESSION_COOKIE_NAME)?.value;const response=NextResponse.json({user:null,error:token?'Your session expired or is invalid. Sign in again.':'Authentication required.',code:token?'SESSION_EXPIRED':'AUTH_REQUIRED'},{status:401});return token?clearSessionCookie(response):response;}return NextResponse.json({user});}
