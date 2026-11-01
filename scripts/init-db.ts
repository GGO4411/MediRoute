import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

function splitSqlStatements(source:string):string[]{
 let delimiter=';',buffer='',statements:string[]=[];
 for(const line of source.split(/\\r?\\n/)){
  const directive=line.trim().match(/^DELIMITER\\s+(\\S+)$/i);
  if(directive){delimiter=directive[1];continue;}
  buffer+=line+'\\n';
  let index:number;
  while((index=buffer.indexOf(delimiter))>=0){
   const statement=buffer.slice(0,index).trim();
   buffer=buffer.slice(index+delimiter.length);
   if(statement)statements.push(statement);
  }
 }
 if(buffer.trim())statements.push(buffer.trim());
 return statements;
}
async function main(){
 const sql=fs.readFileSync(path.join(process.cwd(),'db/schema.sql'),'utf8');
 const conn=await mysql.createConnection({host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_ROOT_USER||'root',password:process.env.MYSQL_ROOT_PASSWORD||process.env.MYSQL_PASSWORD||'',multipleStatements:false});
 try{
  for(const statement of splitSqlStatements(sql))await conn.query(statement);
  console.log('Database schema created.');
 }finally{await conn.end();}
}
main().catch(e=>{console.error(e);process.exit(1);});
