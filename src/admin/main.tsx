import React from 'react'
import ReactDOM from 'react-dom/client'
import AdminApp from './AdminApp'
import '../index.css'
import '../App.css'
import './admin.css'

ReactDOM.createRoot(document.getElementById('admin-root')!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>,
)
