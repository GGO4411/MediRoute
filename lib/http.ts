import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { ZodError } from 'zod';

export type ApiFieldError={field:string;message:string};
export type JsonBodyResult={ok:true;value:unknown}|{ok:false;response:NextResponse};

export function apiError(message:string,status:number,code:string,details?:ApiFieldError[]){
 return NextResponse.json({error:message,code,...(details?.length?{details}:{})},{status});
}

export function validationError(error:ZodError,message='Invalid request details.'){
 const details:ApiFieldError[]=error.issues.map(issue=>({field:issue.path.join('.')||'request',message:issue.message}));
 return apiError(message,400,'VALIDATION_ERROR',details);
}

export async function readJsonBody(request:Request):Promise<JsonBodyResult>{
 try{return {ok:true,value:await request.json()};}
 catch{return {ok:false,response:apiError('Request body must contain valid JSON.',400,'MALFORMED_JSON')};}
}

export function serverError(error:unknown){
 const requestId=randomUUID();
 console.error(`[${requestId}]`,error);
 const response=apiError('The request could not be completed. Check configuration and try again.',500,'INTERNAL_ERROR');
 response.headers.set('x-request-id',requestId);
 return response;
}
