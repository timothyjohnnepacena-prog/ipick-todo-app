"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setStep(2);
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong");
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setError("Passwords do not match");
    }
    
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword }),
    });

    if (res.ok) {
      alert("Password successfully reset! You can now log in.");
      router.push("/auth/signin");
    } else {
      const data = await res.json();
      setError(data.error || "Invalid code");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F3F6] p-4 text-slate-800">
      <div className="bg-white p-10 md:p-12 rounded-[3rem] shadow-2xl w-full max-w-md border border-white text-center">
        
        {/* BRAND LOGO */}
        <div className="flex justify-center mb-4 md:mb-5">
          <img src="/ipick-logo-navbar.png" alt="iPick Center" className="h-16 md:h-20 object-contain" />
        </div>

        <h1 className="text-3xl font-black mb-2 text-[#12A55C] tracking-tighter">Reset Password</h1>
        <p className="text-slate-400 mb-8 text-sm font-medium">
          {step === 1 ? "Enter your email to receive a reset code." : "Enter the 6-digit code and your new password."}
        </p>
        
        {error && <p className="text-[#9E2A2B] text-xs font-bold mb-4 bg-[#9E2A2B]/10 py-2 rounded-xl">{error}</p>}

        {step === 1 ? (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <input 
              type="email" 
              placeholder="Email Address" 
              required 
              autoComplete="email"
              value={email}
              className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-[#12A55C] rounded-2xl outline-none transition-colors" 
              onChange={(e) => setEmail(e.target.value)} 
            />
            <button disabled={loading} type="submit" className="w-full bg-[#12A55C] text-white font-black py-5 rounded-[2rem] hover:bg-[#0e8549] transition-all shadow-xl shadow-[#12A55C]/20 uppercase tracking-widest text-sm disabled:bg-slate-300">
              {loading ? "Sending..." : "Send Reset Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            
            
            <input 
              type="email" 
              name="email" 
              autoComplete="username" 
              value={email} 
              readOnly 
              style={{ display: 'none' }} 
              aria-hidden="true" 
            />

            <input 
              type="text" 
              name="reset-code"
              placeholder="6-Digit Code" 
              required 
              maxLength="6"
              inputMode="numeric"
              autoComplete="one-time-code" 
              value={code}
              className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-[#12A55C] rounded-2xl outline-none transition-colors text-center font-black tracking-[0.5em]" 
              onChange={(e) => setCode(e.target.value)} 
            />
            <input 
              type="password" 
              name="new-password"
              placeholder="New Password" 
              required 
              autoComplete="new-password"
              value={newPassword}
              className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-[#12A55C] rounded-2xl outline-none transition-colors" 
              onChange={(e) => setNewPassword(e.target.value)} 
            />
            <input 
              type="password" 
              name="confirm-password"
              placeholder="Confirm New Password" 
              required 
              autoComplete="new-password"
              value={confirmPassword}
              className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-[#12A55C] rounded-2xl outline-none transition-colors" 
              onChange={(e) => setConfirmPassword(e.target.value)} 
            />
            <button disabled={loading} type="submit" className="w-full bg-[#F37A22] text-white font-black py-5 rounded-[2rem] hover:bg-[#d66718] transition-all shadow-xl shadow-[#F37A22]/20 uppercase tracking-widest text-sm disabled:bg-slate-300">
              {loading ? "Updating..." : "Reset Password"}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 text-sm text-slate-400">
          Remember your password? <Link href="/auth/signin" className="text-[#F37A22] font-bold hover:underline ml-1">Sign In</Link>
        </div>
      </div>
    </div>
  );
}