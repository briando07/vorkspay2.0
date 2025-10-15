
require('dotenv').config();
const mysql = require('mysql2/promise');
async function getConn(){
  const url = process.env.DATABASE_URL;
  const m = url.match(/mysql:\/\/(.*?):(.*?)@(.*?):(\d+)\/(.*)/);
  const user = m[1], pass = m[2], host = m[3], port = m[4], db = m[5];
  return await mysql.createConnection({ host, user, password: pass, database: db, port });
}
async function migrate(){
  const conn = await getConn();
  await conn.query(`
  CREATE TABLE IF NOT EXISTS users (...);
  `);
  console.log('migrate done');
  await conn.end();
}
migrate().catch(e=>{ console.error(e); process.exit(1); });
