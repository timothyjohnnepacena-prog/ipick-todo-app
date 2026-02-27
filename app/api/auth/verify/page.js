"use client";
import { useState } from "react";

export default function VerifyCodePage() {
  const [code, setCode] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] text-slate-800">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-md text-center border border-slate-100">
        <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">✉️</span>
        </div>
        
        <h1 className="text-3xl font-black tracking-tight mb-2">Check your email</h1>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          We sent a verification code to your inbox. <br/>
          Enter the code below to verify your account.
        </p>
        
        <input 
          type="text"
          maxLength="6"
          placeholder="000 000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full text-center text-4xl font-black tracking-[10px] p-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none mb-8 transition-all"
        />
        
        <button 
          onClick={() => alert("Please click the 'Log In Now' link in your email to finish registration!")}
          className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-blue-600 transition-colors"
        >
          Verify Code
        </button>

        <p className="mt-8 text-xs text-slate-400 font-medium">
          {/* FIXED: Using &apos; instead of a plain apostrophe to fix your ESLint error */}
          Didn&apos;t receive it? <button onClick={() => window.location.href='/api/auth/signin'} className="text-blue-500 hover:underline">Try again</button>
        </p>
      </div>
    </div>
  );
}