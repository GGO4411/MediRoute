import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
async function main(){
 const sql=fs.readFileSync(path.join(process.cwd(),'db/schema.sql'),'utf8');
 const conn=await mysql.createConnection({host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||'root',password:process.env.MYSQL_PASSWORD||'',multipleStatements:true});
 try{await conn.query(sql);console.log('Database schema created.');}finally{await conn.end();}
}
main().catch(e=>{console.error(e);process.exit(1);});
