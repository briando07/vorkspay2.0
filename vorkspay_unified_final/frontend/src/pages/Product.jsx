
import React, {useEffect, useState} from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

export default function Product(){
  const { id } = useParams()
  const [product,setProduct]=useState(null)
  const [form,setForm]=useState({email:'', name:'', cpf:'', phone:''})
  const [result,setResult]=useState(null)
  useEffect(()=>{ axios.get('/api/products').then(r=>setProduct(r.data.find(x=>x.id==id))).catch(()=>{}); },[id])
  async function buy(e){
    e.preventDefault()
    const res = await axios.post(`/api/checkout/${id}`, form)
    setResult(res.data)
  }
  if(!product) return <div className="page"><div>Carregando...</div></div>
  return (
    <div className="page">
      <div className="card">
        <h2>{product.title}</h2>
        <p>{product.description}</p>
        <p className="price">R$ {(product.price_cents||0)/100}</p>
        <form onSubmit={buy} className="form">
          <input name="email" placeholder="E-mail" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/>
          <input name="name" placeholder="Nome" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
          <input name="cpf" placeholder="CPF" value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})} required/>
          <input name="phone" placeholder="Telefone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} required/>
          <button className="btn">Finalizar compra</button>
        </form>
        {result && <div className="qr"><img src={result.qr} alt="qr"/><pre className="copy">{result.mp && result.mp.response && result.mp.response.point_of_interaction && result.mp.response.point_of_interaction.transaction_data && result.mp.response.point_of_interaction.transaction_data.qr_code || result.copy}</pre></div>}
      </div>
    </div>
  )
}
