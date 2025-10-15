
import React, {useState} from 'react'
import axios from 'axios'
import { saveToken } from '../utils/auth'
import { useNavigate } from 'react-router-dom'
export default function Login(){
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [err,setErr]=useState('')
  const nav = useNavigate()
  async function submit(e){
    e.preventDefault()
    try{
      const res = await axios.post('/api/auth/login', { email, password })
      saveToken(res.data.token)
      nav('/dashboard')
    }catch(err){ setErr(err.response?.data?.error || 'Erro') }
  }
  return (
    <div className="page auth-page">
      <form className="card form" onSubmit={submit}>
        <h2>Entrar</h2>
        <input placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input placeholder="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button className="btn">Entrar</button>
        <div className="muted">Ainda não tem conta? <a href="/register">Crie uma</a></div>
        <div className="error">{err}</div>
      </form>
    </div>
  )
}
