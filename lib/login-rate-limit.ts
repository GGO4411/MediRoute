import { createHash } from 'node:crypto';
import { db,DBRow } from '@/lib/db';

const MAX_FAILED_ATTEMPTS=5;
const WINDOW_SECONDS=15*60;
const BLOCK_SECONDS=15*60;

export function loginRateLimitKey(clientAddress: string): string {
 return createHash('sha256').update(clientAddress.trim().toLowerCase()).digest('hex');
}

export async function loginRateLimitStatus(key: string): Promise<{limited:boolean;retryAfterSeconds:number}> {
 const conn=await db().getConnection();
 try{
  await conn.execute('INSERT IGNORE INTO login_rate_limits(identifier_hash,window_started_at) VALUES(?,UTC_TIMESTAMP())',[key]);
  const [rows]=await conn.execute<DBRow[]>(`SELECT blocked_until,
   GREATEST(0,TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),blocked_until)) AS retry_after
   FROM login_rate_limits WHERE identifier_hash=?`,[key]);
  const row=rows[0];
  const retryAfterSeconds=Number(row?.retry_after||0);
  if(retryAfterSeconds>0)return {limited:true,retryAfterSeconds};
  const [windows]=await conn.execute<DBRow[]>(`SELECT window_started_at,
   TIMESTAMPDIFF(SECOND,window_started_at,UTC_TIMESTAMP()) AS window_age
   FROM login_rate_limits WHERE identifier_hash=?`,[key]);
  if(Number(windows[0]?.window_age||0)>=WINDOW_SECONDS){
   await conn.execute('UPDATE login_rate_limits SET window_started_at=UTC_TIMESTAMP(),failed_attempts=0,blocked_until=NULL WHERE identifier_hash=?',[key]);
  }
  return {limited:false,retryAfterSeconds:0};
 }finally{conn.release();}
}

export async function recordFailedLogin(key: string): Promise<void> {
 const conn=await db().getConnection();
 try{
  await conn.beginTransaction();
  await conn.execute('INSERT IGNORE INTO login_rate_limits(identifier_hash,window_started_at) VALUES(?,UTC_TIMESTAMP())',[key]);
  const [rows]=await conn.execute<DBRow[]>(`SELECT failed_attempts,
   TIMESTAMPDIFF(SECOND,window_started_at,UTC_TIMESTAMP()) AS window_age
   FROM login_rate_limits WHERE identifier_hash=? FOR UPDATE`,[key]);
  const row=rows[0];
  const previousCount=Number(row?.window_age||0)>=WINDOW_SECONDS?0:Number(row?.failed_attempts||0);
  const failedAttempts=previousCount+1;
  const blockedUntil=failedAttempts>=MAX_FAILED_ATTEMPTS?'DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)':'NULL';
  await conn.execute(`UPDATE login_rate_limits SET window_started_at=IF(?=0,UTC_TIMESTAMP(),window_started_at),
   failed_attempts=?,blocked_until=${blockedUntil} WHERE identifier_hash=?`,
   blockedUntil==='NULL'?[previousCount,failedAttempts,key]:[previousCount,failedAttempts,BLOCK_SECONDS,key]);
  await conn.commit();
 }catch(error){await conn.rollback();throw error;}finally{conn.release();}
}

export async function clearFailedLogins(key: string): Promise<void> {
 await db().execute('DELETE FROM login_rate_limits WHERE identifier_hash=?',[key]);
}
