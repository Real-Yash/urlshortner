"use client";
import Link from "next/link";
import { useState } from "react";
const goals = ["Marketing campaigns", "WhatsApp or Instagram selling", "Developer API integration", "Branded company links", "Agency client management"];
export default function Onboarding() { const [goal,setGoal]=useState(""); return <main className="auth-page"><section className="auth-card"><Link className="brand" href="/"><span className="brand-mark">/</span>linkbase</Link><h1>Set up your workspace</h1><p>Your owner workspace is already ready. Choose a starting point, then create your first link.</p><div className="form">{goals.map(item=><label className="field" key={item}><span><input type="radio" name="goal" value={item} checked={goal===item} onChange={e=>setGoal(e.target.value)}/> {item}</span></label>)}<Link className="button" href="/dashboard/links/new">Create your first link</Link><Link className="button secondary" href="/dashboard">Skip for now</Link></div></section></main>; }
