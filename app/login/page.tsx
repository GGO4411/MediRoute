'use client';
import Link from 'next/link';
import { useState,type FormEvent } from 'react';
export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.error);location.href='/dashboard';}catch(e:any){setError(e.message||'Sign in failed.');}finally{setBusy(false);}}
 return <main className="auth-wrap"><section className="auth-card"><div className="pill">WELCOME BACK</div><h1 style={{fontSize:28,margin:'13px 0 5px'}}>Sign in to MediRoute</h1><p className="muted">Access symptom routing, appointments and records.</p><form onSubmit={submit}><label>Email address</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><label>Password</label><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/>{error&&<div className="alert danger">{error}</div>}<button disabled={busy} className="btn" style={{width:'100%',marginTop:20}}>{busy?'Signing in…':'Sign in'}</button></form><p className="muted" style={{marginTop:18}}>New here? <Link href="/register" style={{color:'#087e8b',fontWeight:700}}>Create a patient account</Link></p></section></main>;
}
