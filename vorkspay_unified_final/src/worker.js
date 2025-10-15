
require('dotenv').config();
const Redis = require('ioredis');
const mysql = require('mysql2/promise');
const { nanoid } = require('nanoid');
const redis = new Redis(process.env.REDIS_URL);

async function getConn(){
  const url = process.env.DATABASE_URL;
  const m = url.match(/mysql:\/\/(.*?):(.*?)@(.*?):(\d+)\/(.*)/);
  const user = m[1], pass = m[2], host = m[3], port = m[4], db = m[5];
  return await mysql.createConnection({ host, user, password: pass, database: db, port });
}

async function run(){
  console.log('Worker started');
  while(true){
    const item = await redis.brpop('vorkspay:jobs', 0);
    if(!item) continue;
    const job = JSON.parse(item[1]);
    console.log('Processing', job);
    // simulate
    await new Promise(r=>setTimeout(r,3000));
    const status = Math.random() < 0.85 ? 'paid' : 'refused';
    const conn = await getConn();
    await conn.query('UPDATE transactions SET status=? WHERE id=?',[status, job.txid]);
    await conn.end();
    console.log('Updated', job.txid, status);
  }
}

run().catch(e=>{ console.error(e); process.exit(1); });
