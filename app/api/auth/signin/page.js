"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export default function SignInPage() {
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    signIn("email", { email, callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F3F6] p-4 text-slate-800">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md border border-white text-center">
        <h1 className="text-4xl font-black mb-2 tracking-tighter text-blue-600">Welcome Back</h1>
        <p className="text-slate-400 mb-8 font-medium">Enter your email to access your board.</p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <input 
            type="email" 
            placeholder="name@example.com" 
            required
            className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-blue-500 transition-all text-center"
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-black py-5 rounded-[2rem] hover:bg-slate-900 transition-all shadow-xl uppercase tracking-widest text-sm">
            Sign In
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-100">
          <p className="text-slate-400 text-sm">
            Don&apos;t have an account? 
            <Link href="/register" className="ml-2 text-blue-600 font-bold hover:underline">
              Register Now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}