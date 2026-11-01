import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
let pool: Pool | undefined;
export function db(): Pool {
 if (!pool) pool=mysql.createPool({
  host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),
  user:process.env.MYSQL_USER||'mediroute',password:process.env.MYSQL_PASSWORD||'',
  database:process.env.MYSQL_DATABASE||'mediroute',waitForConnections:true,connectionLimit:10,
  queueLimit:0,timezone:'Z',decimalNumbers:true,namedPlaceholders:true
 });
 return pool;
}
export type DBRow=RowDataPacket;
export type DBResult=ResultSetHeader;
export type Tx=PoolConnection;
