import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { NextRequest,NextResponse } from 'next/server';
import { GET as readSession } from '../app/api/auth/me/route';

process.env.AUTH_SECRET='session-expiry-test-secret-with-at-least-32-characters';
async function main(){
 const { clearSessionCookie,getSession,SESSION_COOKIE_NAME }=await import('../lib/auth');
 const key=new TextEncoder().encode(process.env.AUTH_SECRET);
 const expiredToken=await new SignJWT({userId:7,name:'Test Patient',email:'session-test@example.com',role:'PATIENT'})
  .setProtectedHeader({alg:'HS256'}).setIssuedAt(Math.floor(Date.now()/1000)-7200)
  .setExpirationTime(Math.floor(Date.now()/1000)-3600).sign(key);
 const expiredRequest=new NextRequest('http://localhost/api/auth/me',{headers:{cookie:`${SESSION_COOKIE_NAME}=${expiredToken}`}});
 assert.equal(await getSession(expiredRequest),null,'expired JWT sessions are rejected');
 const expiredResponse=await readSession(expiredRequest);
 assert.equal(expiredResponse.status,401);
 assert.equal((await expiredResponse.json()).code,'SESSION_EXPIRED');
 assert.equal(expiredResponse.cookies.get(SESSION_COOKIE_NAME)?.maxAge,0,'expired session is invalidated in the browser');

 const validToken=await new SignJWT({userId:7,name:'Test Patient',email:'session-test@example.com',role:'PATIENT'})
  .setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('5m').sign(key);
 const validRequest=new NextRequest('http://localhost/api/auth/me',{headers:{cookie:`${SESSION_COOKIE_NAME}=${validToken}`}});
 assert.equal((await getSession(validRequest))?.userId,7,'valid JWT sessions remain accepted');

 const cleared=clearSessionCookie(NextResponse.json({ok:true}));
 assert.equal(cleared.cookies.get(SESSION_COOKIE_NAME)?.value,'','expired session cookie is cleared');
 assert.equal(cleared.cookies.get(SESSION_COOKIE_NAME)?.maxAge,0,'cleared cookie expires immediately');
 console.log('Session expiry tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
