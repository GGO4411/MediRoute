import assert from 'node:assert/strict';
import { POST as logout } from '../app/api/auth/logout/route';
import { SESSION_COOKIE_NAME } from '../lib/auth';

async function main(){
 const response=await logout();
 assert.equal(response.status,200,'logout succeeds without a session');
 assert.deepEqual(await response.json(),{ok:true});
 const cleared=response.cookies.get(SESSION_COOKIE_NAME);
 assert.equal(cleared?.value,'','logout emits an empty session cookie');
 assert.equal(cleared?.maxAge,0,'logout expires the cookie immediately');
 assert.equal(cleared?.httpOnly,true,'session cookie remains inaccessible to browser scripts');

 // A second logout request is safe, so a stale client can retry cookie cleanup.
 const retry=await logout();
 assert.equal(retry.cookies.get(SESSION_COOKIE_NAME)?.maxAge,0);
 console.log('Logout cookie tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
