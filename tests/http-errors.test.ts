import assert from 'node:assert/strict';
import { z } from 'zod';
import { apiError,readJsonBody,serverError,validationError } from '../lib/http';

async function main(){
 const invalid=apiError('Invalid request.',400,'VALIDATION_ERROR',[{field:'email',message:'Enter a valid email.'}]);
 assert.equal(invalid.status,400);
 assert.deepEqual(await invalid.json(),{error:'Invalid request.',code:'VALIDATION_ERROR',details:[{field:'email',message:'Enter a valid email.'}]});

 const forbidden=apiError('Forbidden.',403,'FORBIDDEN');
 assert.deepEqual(await forbidden.json(),{error:'Forbidden.',code:'FORBIDDEN'});

 const input=z.object({email:z.string().email(),count:z.number()}).safeParse({email:'bad',count:'many'});
 assert.equal(input.success,false);
 if(!input.success){
  const response=validationError(input.error);
  assert.deepEqual((await response.json()).details,[{field:'email',message:'Invalid email'},{field:'count',message:'Expected number, received string'}]);
 }
 const malformed=await readJsonBody(new Request('http://localhost/api/test',{method:'POST',body:'{' }));
 assert.equal(malformed.ok,false,'malformed JSON is rejected before route processing');
 if(!malformed.ok){assert.equal(malformed.response.status,400);assert.equal((await malformed.response.json()).code,'MALFORMED_JSON');}

 const internal=serverError(new Error('database detail must not be returned'));
 assert.equal(internal.status,500);
 assert.deepEqual(await internal.json(),{error:'The request could not be completed. Check configuration and try again.',code:'INTERNAL_ERROR'});
 assert.match(internal.headers.get('x-request-id')||'',/^[0-9a-f-]{36}$/);
 console.log('API error envelope tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
