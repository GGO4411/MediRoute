'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
export function Header(){
 const [user,setUser]=useState<any>(null);
 useEffect(()=>{fetch('/api/auth/me').then(r=>r.ok?r.json():null).then(d=>setUser(d?.user||null)).catch(()=>{});},[]);
 async function logout(){await fetch('/api/auth/logout',{method:'POST'});location.href='/';}
 return <header className="topbar"><div className="topbar-inner"><Link className="brand" href="/">Medi<span>Route</span></Link><nav className="nav"><Link href="/">Home</Link><Link href="/doctors">Doctors</Link>{user?<><Link href="/dashboard">Dashboard</Link><button onClick={logout}>Sign out</button></>:<><Link href="/login">Sign in</Link><Link href="/register">Create account</Link></>}</nav></div></header>;
}
