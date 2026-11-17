import 'dotenv/config';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { POST as rescheduleAppointment } from '../app/api/appointments/[appointmentId]/reschedule/route';
import { GET as readAppointments, PATCH as updateAppointmentStatus } from '../app/api/appointments/route';
import { db } from '../lib/db';

const secret=process.env.AUTH_SECRET||'local-reschedule-test-secret-at-least-32-characters';
process.env.AUTH_SECRET=secret;
const jwtKey=new TextEncoder().encode(secret);
type Actor={userId:number;name:string;email:string;role:'PATIENT'};
const actor=(userId:number,name:string):Actor=>({userId,name,email:`reschedule-${userId}@mediroute.local`,role:'PATIENT'});
async function requestMove(who:Actor,appointmentId:number,slotId:number){
 const token=await new SignJWT({...who}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('5m').sign(jwtKey);
 const request=new NextRequest(`http://localhost/api/appointments/${appointmentId}/reschedule`,{
  method:'POST',headers:{cookie:`mediroute_session=${token}`,'content-type':'application/json'},body:JSON.stringify({slotId})
 });
 return rescheduleAppointment(request,{params:Promise.resolve({appointmentId:String(appointmentId)})});
}
async function requestStatus(who:Actor,appointmentId:number,status:string){
 const token=await new SignJWT({...who}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('5m').sign(jwtKey);
 const request=new NextRequest('http://localhost/api/appointments',{
  method:'PATCH',headers:{cookie:`mediroute_session=${token}`,'content-type':'application/json'},body:JSON.stringify({appointmentId,status})
 });
 return updateAppointmentStatus(request);
}
async function requestHistory(who:Actor,query:string){
 const token=await new SignJWT({...who}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('5m').sign(jwtKey);
 return readAppointments(new NextRequest(`http://localhost/api/appointments?${query}`,{headers:{cookie:`mediroute_session=${token}`}}));
}
const mysqlDate=(d:Date)=>d.toISOString().slice(0,19).replace('T',' ');

async function main(){
 const conn=await mysql.createConnection({host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||'mediroute',password:process.env.MYSQL_PASSWORD||'change-me',database:process.env.MYSQL_DATABASE||'mediroute'});
 const createdUserIds:number[]=[],slotIds:number[]=[],appointmentIds:number[]=[];
 let failureTriggerCreated=false;
 try{
  const [[doctor]]=await conn.execute<any[]>('SELECT doctor_id FROM doctors ORDER BY doctor_id LIMIT 1');
  assert.ok(doctor,'test requires a seeded doctor');
  const suffix=`${Date.now()}-${Math.floor(Math.random()*100000)}`;
  const users:Actor[]=[];
  for(let i=0;i<2;i++){
   const [result]=await conn.execute<any>("INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,'PATIENT')",[`Reschedule API Test ${i}`,`reschedule-api-${suffix}-${i}@mediroute.local`,'integration-test-only']);
   const userId=Number(result.insertId);createdUserIds.push(userId);users.push(actor(userId,`Reschedule API Test ${i}`));
  }
  const [grant]=await conn.execute<any[]>('SELECT COUNT(*) AS n FROM role_permissions WHERE role_code=\'PATIENT\' AND permission_code=\'APPOINTMENT_RESCHEDULE_OWN\'');
  assert.equal(Number(grant[0].n),1,'patient role should have the reschedule permission');
  const base=new Date(Date.now()+45*86400000+Math.floor(Math.random()*600)*60000);base.setUTCSeconds(0,0);
  for(let i=0;i<10;i++){
   const start=new Date(base.getTime()+i*3600000),end=new Date(start.getTime()+30*60000);
   const [result]=await conn.execute<any>("INSERT INTO appointment_slots(doctor_id,starts_at,ends_at,status) VALUES(?,?,?,'AVAILABLE')",[doctor.doctor_id,mysqlDate(start),mysqlDate(end)]);
   slotIds.push(Number(result.insertId));
  }
  const appointment=async (patientIndex:number,slotIndex:number)=>{
   const [result]=await conn.execute<any>("INSERT INTO appointments(patient_id,doctor_id,slot_id,urgency) VALUES(?,?,?,'ROUTINE')",[users[patientIndex].userId,doctor.doctor_id,slotIds[slotIndex]]);
   const id=Number(result.insertId);appointmentIds.push(id);return id;
  };
  const successId=await appointment(0,0);
  const ownedByOtherId=await appointment(1,1);
  const cancelledId=await appointment(0,2);
  await conn.execute("UPDATE appointments SET status='CANCELLED' WHERE appointment_id=?",[cancelledId]);
  await conn.execute("UPDATE appointment_slots SET status='BLOCKED' WHERE slot_id=?",[slotIds[3]]);
  const rollbackId=await appointment(0,4);
  const concurrentA=await appointment(0,6),concurrentB=await appointment(1,7);

  let response=await requestMove(users[1],successId,slotIds[3]);
  assert.equal(response.status,403,'a different patient cannot reschedule this appointment');
  response=await requestMove(users[0],cancelledId,slotIds[3]);
  assert.equal(response.status,409,'a cancelled appointment cannot be rescheduled');
  response=await requestMove(users[0],ownedByOtherId,slotIds[3]);
  assert.equal(response.status,403,'the patient cannot reschedule another patient appointment');
  response=await requestMove(users[0],successId,slotIds[3]);
  assert.equal(response.status,409,'a blocked/unavailable slot is rejected');
  const [[unchanged]]=await conn.execute<any[]>('SELECT slot_id FROM appointments WHERE appointment_id=?',[successId]);
  assert.equal(Number(unchanged.slot_id),slotIds[0],'failed requests leave the appointment unchanged');

  response=await requestMove(users[0],successId,slotIds[5]);
  assert.equal(response.status,200,'valid reschedule should succeed');
  const [[moved]]=await conn.execute<any[]>('SELECT slot_id FROM appointments WHERE appointment_id=?',[successId]);
  assert.equal(Number(moved.slot_id),slotIds[5]);
  const [moveAudit]=await conn.execute<any[]>('SELECT old_slot_id,new_slot_id,changed_by FROM appointment_reschedule_audit WHERE appointment_id=?',[successId]);
  assert.equal(moveAudit.length,1,'successful route call writes a reschedule audit row');
  assert.equal(Number(moveAudit[0].old_slot_id),slotIds[0]);assert.equal(Number(moveAudit[0].new_slot_id),slotIds[5]);
  const historyResponse=await requestHistory(users[0],'filter=ALL&page=1&pageSize=1');
  assert.equal(historyResponse.status,200,'history endpoint accepts page and pageSize');
  const historyPage=await historyResponse.json();
  assert.equal(historyPage.appointments.length,1);assert.equal(historyPage.pagination.page,1);assert.equal(historyPage.pagination.pageSize,1);
  assert.equal(historyPage.pagination.hasMore,true,'history reports another page when more test appointments exist');
  const fullHistoryResponse=await requestHistory(users[0],'filter=ALL&page=1&pageSize=100');
  const fullHistory=await fullHistoryResponse.json();
  const movedHistory=fullHistory.appointments.find((a:any)=>Number(a.appointment_id)===successId);
  assert.ok(movedHistory?.history.some((event:any)=>event.action==='RESCHEDULED'),'history API returns reschedule events');
  await conn.execute("UPDATE appointments SET status='CONFIRMED' WHERE appointment_id=?",[ownedByOtherId]);
  await conn.execute("UPDATE appointments SET status='COMPLETED' WHERE appointment_id=?",[ownedByOtherId]);
  await conn.execute('UPDATE appointment_slots SET starts_at=?,ends_at=? WHERE slot_id=?',[mysqlDate(new Date(Date.now()-2*86400000)),mysqlDate(new Date(Date.now()-2*86400000+1800000)),slotIds[1]]);
  const pastResponse=await requestHistory(users[1],'filter=PAST&page=1&pageSize=100');
  const pastData=await pastResponse.json();
  assert.ok(pastData.appointments.some((a:any)=>Number(a.appointment_id)===ownedByOtherId&&a.status==='COMPLETED'),'Past filter includes completed appointments whose slot time is past');

  let slotGuarded=false;
  try{await conn.execute('UPDATE appointments SET slot_id=? WHERE appointment_id=?',[slotIds[9],successId]);}catch(error:any){slotGuarded=error?.sqlState==='45000';}
  assert.ok(slotGuarded,'database trigger rejects a slot change without reserving the target and releasing the source');
  let auditDeleteBlocked=false;
  try{await conn.execute('DELETE FROM appointments WHERE appointment_id=?',[successId]);}catch(error:any){auditDeleteBlocked=error?.code==='ER_ROW_IS_REFERENCED_2';}
  assert.ok(auditDeleteBlocked,'appointment audit rows prevent deletion of their parent appointment');
  let prescriptionMismatchBlocked=false;
  try{await conn.execute('INSERT INTO prescriptions(appointment_id,doctor_id,patient_id,medication_name) VALUES(?,?,?,?)',[ownedByOtherId,doctor.doctor_id,users[0].userId,'Integrity test']);}catch(error:any){prescriptionMismatchBlocked=error?.sqlState==='45000';}
  assert.ok(prescriptionMismatchBlocked,'database trigger rejects a prescription with a patient that differs from its appointment');

  // Cause a database error after the route has updated both slots and the appointment.
  await conn.query(`CREATE TRIGGER trg_test_reschedule_audit_failure BEFORE INSERT ON appointment_reschedule_audit FOR EACH ROW BEGIN IF NEW.appointment_id=${rollbackId} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test rollback'; END IF; END`);
  failureTriggerCreated=true;
  response=await requestMove(users[0],rollbackId,slotIds[9]);
  assert.equal(response.status,500,'a late audit failure surfaces as a failed request');
  const [[rollbackAppointment]]=await conn.execute<any[]>('SELECT slot_id FROM appointments WHERE appointment_id=?',[rollbackId]);
  assert.equal(Number(rollbackAppointment.slot_id),slotIds[4],'audit failure rolls back the appointment move');
  const [rollbackSlots]=await conn.execute<any[]>('SELECT slot_id,status FROM appointment_slots WHERE slot_id IN (?,?)',[slotIds[4],slotIds[9]]);
  assert.deepEqual(Object.fromEntries(rollbackSlots.map(r=>[Number(r.slot_id),r.status])),{[slotIds[4]]:'BOOKED',[slotIds[9]]:'AVAILABLE'},'audit failure rolls back both slot changes');
  await conn.query('DROP TRIGGER IF EXISTS trg_test_reschedule_audit_failure');failureTriggerCreated=false;

  const statusRaceId=await appointment(0,9);
  const statusRace=await Promise.all([requestStatus(users[0],statusRaceId,'CANCELLED'),requestStatus(users[0],statusRaceId,'CANCELLED')]);
  assert.deepEqual(statusRace.map(r=>r.status).sort(),[200,409],'only one concurrent status request may close an appointment');
  const [[statusAfterRace]]=await conn.execute<any[]>('SELECT status FROM appointments WHERE appointment_id=?',[statusRaceId]);
  assert.equal(statusAfterRace.status,'CANCELLED','the status race leaves one valid closed state');

  const concurrent=await Promise.all([requestMove(users[0],concurrentA,slotIds[8]),requestMove(users[1],concurrentB,slotIds[8])]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409],'only one concurrent request may reserve the same target slot');
  const [[reservationCount]]=await conn.execute<any[]>('SELECT COUNT(*) AS n FROM appointments WHERE slot_id=? AND status IN (\'BOOKED\',\'CONFIRMED\')',[slotIds[8]]);
  assert.equal(Number(reservationCount.n),1,'the shared target slot has one active appointment');
  console.log('Appointment API checks passed: reschedule ownership, closed status, unavailable target, successful move, audit rollback, concurrent reschedules and concurrent status updates.');
 }finally{
  if(failureTriggerCreated)await conn.query('DROP TRIGGER IF EXISTS trg_test_reschedule_audit_failure');
  await conn.beginTransaction();
  try{
   if(appointmentIds.length){const marks=appointmentIds.map(()=>'?').join(',');await conn.execute(`DELETE FROM appointment_reschedule_audit WHERE appointment_id IN (${marks})`,appointmentIds);await conn.execute(`DELETE FROM appointment_audit WHERE appointment_id IN (${marks})`,appointmentIds);await conn.execute(`DELETE FROM prescriptions WHERE appointment_id IN (${marks})`,appointmentIds);await conn.execute(`DELETE FROM appointments WHERE appointment_id IN (${marks})`,appointmentIds);}
   if(slotIds.length)await conn.execute(`DELETE FROM appointment_slots WHERE slot_id IN (${slotIds.map(()=>'?').join(',')})`,slotIds);
   if(createdUserIds.length)await conn.execute(`DELETE FROM users WHERE user_id IN (${createdUserIds.map(()=>'?').join(',')})`,createdUserIds);
   await conn.commit();
  }catch(error){await conn.rollback();throw error;}
  await conn.end();
  await db().end();
 }
}
main().catch(error=>{console.error(error);process.exit(1);});
