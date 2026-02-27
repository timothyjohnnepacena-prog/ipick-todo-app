"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await signIn("credentials", { username, password, redirect: false });
    if (res.ok) {
      router.push("/");
    } else {
      setError("❌ Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F3F6] p-4 text-slate-800">
      <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl w-full max-w-md border border-white text-center">
        
        {/* LOGO */}
        <div className="flex justify-center mb-4 md:mb-5">
          <img src="/ipick-logo-navbar.png" alt="iPick Center" className="h-16 md:h-20 object-contain" />
        </div>

        <h1 className="text-3xl font-black mb-2 text-[#12A55C] tracking-tighter">Welcome Back</h1>
        <p className="text-slate-400 mb-10 font-medium text-sm">Enter your credentials to access your board.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            placeholder="Username" 
            required 
            className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-[#12A55C] rounded-2xl outline-none transition-colors" 
            onChange={(e) => setUsername(e.target.value)} 
          />
          
          {/* PASSWORD FIELD & FORGOT PASSWORD LINK GROUPED */}
          <div className="text-right">
            <input 
              type="password" 
              placeholder="Password" 
              required 
              className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-[#12A55C] rounded-2xl outline-none transition-colors mb-2" 
              onChange={(e) => setPassword(e.target.value)} 
            />
            <Link 
              href="/auth/forgot-password" 
              className="text-[11px] font-bold text-slate-400 hover:text-[#F37A22] transition-colors pr-2 inline-block"
            >
              Forgot Password?
            </Link>
          </div>

          {error && <p className="text-[#9E2A2B] text-xs font-bold">{error}</p>}
          
          <button type="submit" className="w-full bg-[#12A55C] text-white font-black py-5 rounded-[2rem] hover:bg-[#0e8549] transition-all shadow-xl shadow-[#12A55C]/20 uppercase tracking-widest text-sm mt-2">
            Sign In
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-100 text-sm text-slate-400">
          Don&apos;t have an account? <Link href="/register" className="text-[#F37A22] font-bold hover:underline ml-1">Register Now</Link>
        </div>
      </div>
    </div>
  );
}