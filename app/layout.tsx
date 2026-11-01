import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Header } from '@/components/Header';
export const metadata:Metadata={title:'MediRoute | Symptom Triage & Specialist Routing',description:'AI-assisted symptom triage and specialist routing demonstration.'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body><div className="shell"><Header/>{children}<footer className="footer">MediRoute · Educational routing demonstration · Not a diagnostic or emergency service</footer></div></body></html>;}
