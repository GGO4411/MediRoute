import assert from 'node:assert/strict';
import { apiError,serverError } from '../lib/http';

async function main(){
 const invalid=apiError('Invalid request.',400,'VALIDATION_ERROR',[{field:'email',message:'Enter a valid email.'}]);
 assert.equal(invalid.status,400);
 assert.deepEqual(await invalid.json(),{error:'Invalid request.',code:'VALIDATION_ERROR',details:[{field:'email',message:'Enter a valid email.'}]});

 const forbidden=apiError('Forbidden.',403,'FORBIDDEN');
 assert.deepEqual(await forbidden.json(),{error:'Forbidden.',code:'FORBIDDEN'});

 const internal=serverError(new Error('database detail must not be returned'));
 assert.equal(internal.status,500);
 assert.deepEqual(await internal.json(),{error:'The request could not be completed. Check configuration and try again.',code:'INTERNAL_ERROR'});
 assert.match(internal.headers.get('x-request-id')||'',/^[0-9a-f-]{36}$/);
 console.log('API error envelope tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
