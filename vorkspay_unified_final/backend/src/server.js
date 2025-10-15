
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const qrcode = require('qrcode');
const mercadopago = require('mercadopago');
const { nanoid } = require('nanoid');
const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

mercadopago.configure({ access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN || '' });

const poolConfig = { uri: process.env.DATABASE_URL };
const redis = new Redis(process.env.REDIS_URL);

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });
const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(uploadDir));

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

function sign(payload){ return jwt.sign(payload, JWT_SECRET, { expiresIn:'30d' }); }
async function auth(req,res,next){
  const a = req.headers.authorization;
  if(!a) return res.status(401).json({error:'no token'});
  try{ req.user = jwt.verify(a.replace('Bearer ','').trim(), JWT_SECRET); next(); }catch(e){ return res.status(401).json({error:'invalid token'}); }
}

// helper to get db connection via mysql2 using DATABASE_URL
async function getConn(){
  const url = process.env.DATABASE_URL;
  // parse mysql://user:pass@host:port/db
  const m = url.match(/mysql:\/\/(.*?):(.*?)@(.*?):(\d+)\/(.*)/);
  if(!m) throw new Error('Invalid DATABASE_URL');
  const user = m[1], pass = m[2], host = m[3], port = m[4], db = m[5];
  return await mysql.createConnection({ host, user, password: pass, database: db, port });
}

// simple migrate: create tables
app.get('/migrate', async (req,res)=>{
  try{
    const conn = await getConn();
    await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255),
      full_name VARCHAR(255),
      cpf VARCHAR(32) UNIQUE,
      phone VARCHAR(64),
      street VARCHAR(255),
      number VARCHAR(64),
      complement VARCHAR(255),
      cep VARCHAR(32),
      apartment BOOLEAN DEFAULT FALSE,
      city VARCHAR(128),
      state VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS merchants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      api_key VARCHAR(255) UNIQUE,
      owner_email VARCHAR(255),
      balance_cents BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      merchant_id INT,
      title TEXT,
      description TEXT,
      image VARCHAR(512),
      site VARCHAR(512),
      support_email VARCHAR(255),
      price_cents INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(128) PRIMARY KEY,
      merchant_id INT,
      product_id INT,
      amount_cents INT,
      status VARCHAR(32),
      customer_email VARCHAR(255),
      customer_name VARCHAR(255),
      customer_cpf VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `);
    await conn.end();
    res.json({ok:true});
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

// Register/login
app.post('/api/auth/register', async (req,res)=>{
  try{
    const { email, password, fullName, cpf, phone, street, number, complement, cep, apartment, city, state } = req.body;
    if(!email||!password) return res.status(400).json({error:'email+password'});
    const conn = await getConn();
    const [rows] = await conn.query('SELECT id FROM users WHERE email=? OR cpf=?',[email, cpf]);
    if(rows.length) { await conn.end(); return res.status(409).json({error:'exists'}); }
    const hash = await bcrypt.hash(password, 10);
    await conn.query('INSERT INTO users(email,password_hash,full_name,cpf,phone,street,number,complement,cep,apartment,city,state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      [email, hash, fullName||'', cpf||'', phone||'', street||'', number||'', complement||'', cep||'', apartment?1:0, city||'', state||'']);
    await conn.end();
    const token = sign({ email });
    res.json({ token });
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

app.post('/api/auth/login', async (req,res)=>{
  try{
    const { email, password } = req.body;
    const conn = await getConn();
    const [rows] = await conn.query('SELECT * FROM users WHERE email=?',[email]);
    if(!rows.length){ await conn.end(); return res.status(401).json({error:'invalid'}); }
    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if(!ok){ await conn.end(); return res.status(401).json({error:'invalid'}); }
    await conn.end();
    const token = sign({ email });
    res.json({ token });
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

// Products
app.post('/api/products', auth, upload.single('image'), async (req,res)=>{
  try{
    const tokenEmail = req.user && req.user.email;
    const conn = await getConn();
    // ensure merchant exists
    const [mrows] = await conn.query('SELECT * FROM merchants WHERE owner_email=?',[tokenEmail]);
    let merchant;
    if(!mrows.length){
      const [r] = await conn.query('INSERT INTO merchants(name,api_key,owner_email) VALUES(?,?,?)',[tokenEmail+"'s shop", 'mk_'+nanoid(20), tokenEmail]);
      merchant = { id: r.insertId };
    } else merchant = mrows[0];
    const { title, description, site, support_email, price_cents } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : null;
    const [p] = await conn.query('INSERT INTO products(merchant_id,title,description,image,site,support_email,price_cents) VALUES(?,?,?,?,?,?,?)',
      [merchant.id, title, description, image, site, support_email, parseInt(price_cents||0)]);
    await conn.end();
    res.json({ id: p.insertId, merchant_id: merchant.id, title });
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

app.get('/api/products', async (req,res)=>{
  try{
    const conn = await getConn();
    const [rows] = await conn.query('SELECT p.*, m.name as merchant_name FROM products p LEFT JOIN merchants m ON m.id=p.merchant_id ORDER BY p.created_at DESC');
    await conn.end();
    res.json(rows);
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

// checkout via Mercado Pago (creates a payment with payment_method_id 'pix' if supported)
app.post('/api/checkout/:productId', async (req,res)=>{
  try{
    const productId = parseInt(req.params.productId);
    const conn = await getConn();
    const [prows] = await conn.query('SELECT * FROM products WHERE id=?',[productId]);
    if(!prows.length){ await conn.end(); return res.status(404).json({error:'not found'}); }
    const product = prows[0];
    const { email, name, cpf, phone } = req.body;
    const txid = 'tx_' + nanoid(12);
    await conn.query('INSERT INTO transactions(id,merchant_id,product_id,amount_cents,status,customer_email,customer_name,customer_cpf) VALUES(?,?,?,?,?,?,?,?)',
      [txid, product.merchant_id, product.id, product.price_cents, 'created', email, name, cpf]);
    await conn.end();
    // create Mercado Pago payment (sandbox)
    const payment_data = {
      transaction_amount: product.price_cents/100,
      payment_method_id: "pix",
      payer: {
        email: email,
        first_name: name || 'Cliente'
      }
    };
    const mpRes = await mercadopago.payment.create(payment_data);
    const qr = (mpRes && mpRes.response && mpRes.response.point_of_interaction && mpRes.response.point_of_interaction.transaction_data && mpRes.response.point_of_interaction.transaction_data.qr_code) || null;
    res.json({ txid, qr, mp: mpRes && mpRes.response });
    // push job
    await redis.lpush('vorkspay:jobs', JSON.stringify({ txid, productId }));
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

// transactions for user (requires auth)
app.get('/api/transactions', auth, async (req,res)=>{
  try{
    const conn = await getConn();
    const [rows] = await conn.query('SELECT t.*, p.title as product_title FROM transactions t LEFT JOIN products p ON p.id=t.product_id ORDER BY t.created_at DESC');
    await conn.end();
    res.json(rows);
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

// admin stats
app.get('/api/admin/stats', auth, async (req,res)=>{
  try{
    const conn = await getConn();
    const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM transactions') .then(r=>[r[0]]);
    const [[{ paid }]] = await conn.query("SELECT COUNT(*) as paid FROM transactions WHERE status='paid'").then(r=>[r[0]]);
    const [[{ created }]] = await conn.query("SELECT COUNT(*) as created FROM transactions WHERE status='created'").then(r=>[r[0]]);
    const [[{ refused }]] = await conn.query("SELECT COUNT(*) as refused FROM transactions WHERE status='refused'").then(r=>[r[0]]);
    await conn.end();
    res.json({ total, paid, created, refused });
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

app.get('/', (req,res)=>res.json({ ok:true }));

app.listen(process.env.PORT||3333, ()=>console.log('Vorkspay backend running on', process.env.PORT||3333));
