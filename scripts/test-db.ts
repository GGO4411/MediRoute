import 'dotenv/config';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';

async function main(){
 const conn=await mysql.createConnection({
  host:process.env.MYSQL_HOST||'127.0.0.1',
  port:Number(process.env.MYSQL_PORT||3306),
  user:process.env.MYSQL_USER||'mediroute',
  password:process.env.MYSQL_PASSWORD||'change-me',
  database:process.env.MYSQL_DATABASE||'mediroute'
 });
 try{
  await conn.query("CALL sp_calculate_urgency('cannot breathe', @test_score, @test_level)");
  const [scoreRows]:any=await conn.query('SELECT @test_score AS score,@test_level AS level');
  assert.equal(Number(scoreRows[0].score),100,'stored procedure should flag emergency phrase');
  assert.equal(scoreRows[0].level,'EMERGENCY','stored procedure should return emergency level');

  const [patients]:any=await conn.execute('SELECT user_id FROM users WHERE email=? LIMIT 1',['patient@mediroute.local']);
  const [doctors]:any=await conn.execute("SELECT doctor_id FROM doctors ORDER BY doctor_id LIMIT 1");
  const [slots]:any=await conn.execute("SELECT slot_id,doctor_id FROM appointment_slots WHERE status='AVAILABLE' AND starts_at>UTC_TIMESTAMP() ORDER BY starts_at LIMIT 1");
  assert.ok(patients[0]&&doctors[0]&&slots[0],'seed data must include a patient, doctor and future slot');
  const patientId=Number(patients[0].user_id),doctorId=Number(slots[0].doctor_id),slotId=Number(slots[0].slot_id);

  const [emergencyInsert]:any=await conn.execute(
   "INSERT INTO triage_sessions(patient_id,symptom_text,urgency,urgency_score) VALUES(?,?,'EMERGENCY',100)",
   [patientId,'cannot breathe']
  );
  const emergencyTriageId=Number(emergencyInsert.insertId);
  let emergencyBookingBlocked=false;
  try{
   await conn.execute(
    "INSERT INTO appointments(patient_id,doctor_id,slot_id,triage_id,urgency) VALUES(?,?,?,?,'EMERGENCY')",
    [patientId,doctorId,slotId,emergencyTriageId]
   );
  }catch(error:any){emergencyBookingBlocked=error?.sqlState==='45000';}
  assert.ok(emergencyBookingBlocked,'database trigger should reject booking from an emergency triage session');

  const [routineInsert]:any=await conn.execute(
   "INSERT INTO triage_sessions(patient_id,symptom_text,urgency,urgency_score) VALUES(?,?,'ROUTINE',15)",
   [patientId,'mild non-urgent concern for integration test']
  );
  const routineTriageId=Number(routineInsert.insertId);
  const [booking]:any=await conn.execute(
   "INSERT INTO appointments(patient_id,doctor_id,slot_id,triage_id,urgency) VALUES(?,?,?,?,'ROUTINE')",
   [patientId,doctorId,slotId,routineTriageId]
  );
  const appointmentId=Number(booking.insertId);
  const [bookedRows]:any=await conn.execute('SELECT status FROM appointment_slots WHERE slot_id=?',[slotId]);
  assert.equal(bookedRows[0].status,'BOOKED','appointment insert trigger should mark slot BOOKED');

  let duplicateBlocked=false;
  try{
   await conn.execute(
    "INSERT INTO appointments(patient_id,doctor_id,slot_id,triage_id,urgency) VALUES(?,?,?,?,'ROUTINE')",
    [patientId,doctorId,slotId,routineTriageId]
   );
  }catch(error:any){duplicateBlocked=error?.sqlState==='45000';}
  assert.ok(duplicateBlocked,'trigger should reject a second booking for the same slot');

  await conn.execute("UPDATE appointments SET status='CANCELLED' WHERE appointment_id=?",[appointmentId]);
  const [releasedRows]:any=await conn.execute('SELECT status FROM appointment_slots WHERE slot_id=?',[slotId]);
  assert.equal(releasedRows[0].status,'AVAILABLE','cancellation trigger should release the slot');

  await conn.execute(
   "INSERT INTO appointments(patient_id,doctor_id,slot_id,triage_id,urgency) VALUES(?,?,?,?,'ROUTINE')",
   [patientId,doctorId,slotId,routineTriageId]
  );
  const [auditRows]:any=await conn.execute("SELECT COUNT(*) AS count FROM appointment_audit WHERE appointment_id=?",[appointmentId]);
  assert.ok(Number(auditRows[0].count)>=2,'appointment triggers should write audit entries');
  console.log('MySQL integration checks passed: procedure, emergency guard, booking, duplicate prevention, cancellation, slot reuse and audit trail.');
 }finally{
  await conn.end();
 }
}
main().catch(error=>{console.error(error);process.exit(1);});
