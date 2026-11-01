import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
async function main(){
 const conn=await mysql.createConnection({host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||'mediroute',password:process.env.MYSQL_PASSWORD||'change-me',database:process.env.MYSQL_DATABASE||'mediroute'});
 try{
  const specialties=['General Medicine','Neurology','Ophthalmology','Cardiology','Dermatology','Orthopedics','ENT','Gastroenterology','Pulmonology','Psychiatry'];
  for(const s of specialties)await conn.execute('INSERT IGNORE INTO specialties(name,description) VALUES(?,?)',[s,'Clinical specialty: '+s]);
  const pass=await bcrypt.hash('DemoPass123!',12);
  const users=[['Demo Patient','patient@mediroute.local','PATIENT'],['Dr. Asha Rao','asha.rao@mediroute.local','DOCTOR'],['Dr. Vikram Sen','vikram.sen@mediroute.local','DOCTOR'],['Dr. Meera Nair','meera.nair@mediroute.local','DOCTOR'],['System Admin','admin@mediroute.local','ADMIN']];
  for(const [name,email,role] of users)await conn.execute('INSERT IGNORE INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)',[name,email,pass,role]);
  const doctors=[['asha.rao@mediroute.local','Neurology','MBBS, MD (Neurology)',12,850],['vikram.sen@mediroute.local','Ophthalmology','MBBS, MS (Ophthalmology)',9,750],['meera.nair@mediroute.local','General Medicine','MBBS, MD (Internal Medicine)',15,600]];
  for(const [email,specialty,qualification,years,fee] of doctors){
   const [ur]:any=await conn.query('SELECT user_id FROM users WHERE email=?',[email]);const [sr]:any=await conn.query('SELECT specialty_id FROM specialties WHERE name=?',[specialty]);
   const u=ur[0],s=sr[0];if(!u||!s)continue;
   await conn.execute('INSERT IGNORE INTO doctors(user_id,specialty_id,qualification,years_experience,consultation_fee,bio) VALUES(?,?,?,?,?,?)',[u.user_id,s.specialty_id,qualification,years,fee,'Sample profile for demonstrating specialist routing.']);
   const [dr]:any=await conn.query('SELECT doctor_id FROM doctors WHERE user_id=?',[u.user_id]);const d=dr[0];if(!d)continue;
   for(let day=1;day<=7;day++)for(const hour of [9,11,14,16]){
    const start=new Date();start.setDate(start.getDate()+day);start.setHours(hour,0,0,0);const end=new Date(start.getTime()+30*60000);
    const fmt=(x:Date)=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')+' '+String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0')+':00';
    await conn.execute('INSERT IGNORE INTO appointment_slots(doctor_id,starts_at,ends_at) VALUES(?,?,?)',[d.doctor_id,fmt(start),fmt(end)]);
   }
  }
  console.log('Seed complete. Demo accounts use password: DemoPass123!');
 }finally{await conn.end();}
}
main().catch(e=>{console.error(e);process.exit(1);});
