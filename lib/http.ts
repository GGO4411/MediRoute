import { NextResponse } from 'next/server';
export function serverError(error:unknown){console.error(error);return NextResponse.json({error:'The request could not be completed. Check configuration and try again.'},{status:500});}
