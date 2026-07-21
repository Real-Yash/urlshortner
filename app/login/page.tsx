"use client";

import Link from "next/link";
import { supabase } from "@/app/lib/supabase/browser";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | "">("");
  const router = useRouter();

  async function submit(signUp: boolean) {
    setBusy("email"); setMessage("");
    const result = signUp ? await supabase().auth.signUp({ email, password }) : await supabase().auth.signInWithPassword({ email, password });
    setBusy("");
    if (result.error) return setMessage(result.error.message);
    if (result.data.session) router.replace(signUp ? "/onboarding" : "/dashboard");
    else setMessage("Check your email to confirm your account, then sign in.");
  }

  async function google() {
    setBusy("google"); setMessage("");
    const result = await supabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/dashboard` } });
    if (result.error) { setBusy(""); setMessage(result.error.message); }
  }

  return <main className="auth-page"><section className="auth-layout"><aside className="auth-aside"><Link className="brand" href="/"><span className="brand-mark">/</span>linkbase</Link><div><span className="eyebrow">Link infrastructure, not just short URLs</span><h1>Built for the links your business depends on.</h1><p>Create, manage, and safely redirect links from a dashboard and versioned API that stay in sync.</p></div><div className="auth-points"><span>✓ Hosted domains available now</span><span>✓ Session-authenticated management API</span><span>✓ Fast global redirects</span></div></aside><section className="auth-card"><Link className="brand auth-mobile-brand" href="/"><span className="brand-mark">/</span>linkbase</Link><div className="auth-heading"><h2>Welcome back</h2><p>Sign in to manage your links.</p></div><div className="social-login"><button className="social-button" onClick={google} disabled={!!busy}><GoogleIcon />{busy === "google" ? "Redirecting…" : "Continue with Google"}</button></div><div className="divider"><span>or continue with email</span></div><form className="form" onSubmit={event => { event.preventDefault(); submit(false); }}><label className="field">Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><label className="field">Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} required /></label><button className="button" disabled={!!busy}>{busy === "email" ? "Please wait…" : "Sign in"}</button><button type="button" className="text-button" disabled={!!busy} onClick={() => submit(true)}>New here? Create an account</button>{message && <p className={message.startsWith("Check") ? "success" : "error"} role="status">{message}</p>}</form><p className="auth-terms">By continuing, you agree to the Terms and Privacy Policy.</p></section></section></main>;
}
function GoogleIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3.1-4.4 3.1-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.2 13.7a6 6 0 0 1 0-3.5V7.6H2.9a10 10 0 0 0 0 8.8l3.3-2.7Z"/><path fill="#EA4335" d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.8-2.8A9.9 9.9 0 0 0 2.9 7.6l3.3 2.6C7 7.8 9.3 6 12 6Z"/></svg>; }
