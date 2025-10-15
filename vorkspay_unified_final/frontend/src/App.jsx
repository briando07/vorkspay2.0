
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Marketplace from './pages/Marketplace'
import Product from './pages/Product'
import CreateProduct from './pages/CreateProduct'
import Header from './components/Header'
import { getToken } from './utils/auth'

function PrivateRoute({ children }){
  return getToken() ? children : <Navigate to="/login" />;
}

export default function App(){
  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/login" element={<Login/>} />
        <Route path="/register" element={<Register/>} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard/></PrivateRoute>} />
        <Route path="/marketplace" element={<Marketplace/>} />
        <Route path="/product/:id" element={<Product/>} />
        <Route path="/create-product" element={<PrivateRoute><CreateProduct/></PrivateRoute>} />
      </Routes>
    </div>
  )
}
