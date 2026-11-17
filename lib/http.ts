import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export type ApiFieldError={field:string;message:string};

export function apiError(message:string,status:number,code:string,details?:ApiFieldError[]){
 return NextResponse.json({error:message,code,...(details?.length?{details}:{})},{status});
}

export function serverError(error:unknown){
 const requestId=randomUUID();
 console.error(`[${requestId}]`,error);
 const response=apiError('The request could not be completed. Check configuration and try again.',500,'INTERNAL_ERROR');
 response.headers.set('x-request-id',requestId);
 return response;
}
