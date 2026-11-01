import { NextRequest,NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
export async function GET(req:NextRequest){const user=await getSession(req);return user?NextResponse.json({user}):NextResponse.json({user:null},{status:401});}
