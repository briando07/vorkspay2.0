
import React, {useState} from 'react'
import axios from 'axios'
import { authHeader } from '../utils/auth'
export default function CreateProduct(){
  const [form,setForm]=useState({title:'', description:'', site:'', support_email:'', price_cents:0})
  const [file,setFile]=useState(null)
  const [msg,setMsg]=useState('')
  async function submit(e){
    e.preventDefault()
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('description', form.description)
    fd.append('site', form.site)
    fd.append('support_email', form.support_email)
    fd.append('price_cents', form.price_cents)
    if(file) fd.append('image', file)
    try{
      const res = await axios.post('/api/products', fd, { headers: {...authHeader(), 'Content-Type': 'multipart/form-data'} })
      setMsg('Produto criado!')
      setForm({title:'',description:'',site:'',support_email:'',price_cents:0})
      setFile(null)
    }catch(e){ setMsg('Erro: '+(e.response?.data?.error||e.message)) }
  }
  return (
    <div className="page">
      <form className="card form wide" onSubmit={submit}>
        <h2>Criar Produto</h2>
        <input placeholder="Título" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/>
        <textarea placeholder="Descrição" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required/>
        <input placeholder="Site do produto" value={form.site} onChange={e=>setForm({...form,site:e.target.value})}/>
        <input placeholder="E-mail de suporte" value={form.support_email} onChange={e=>setForm({...form,support_email:e.target.value})}/>
        <input placeholder="Preço em centavos (ex: 19900)" value={form.price_cents} onChange={e=>setForm({...form,price_cents:e.target.value})} required/>
        <input type="file" onChange={e=>setFile(e.target.files[0])} />
        <button className="btn">Criar produto</button>
        <div className="muted">{msg}</div>
      </form>
    </div>
  )
}
