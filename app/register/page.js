"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: "", nickname: "", username: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    const { password, confirmPassword } = formData;

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const isLongEnough = password.length >= 8;

    if (!isLongEnough || !hasUpperCase || !hasLowerCase || !hasNumbers) {
      return setError("Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, and a number.");
    }

    if (password !== confirmPassword) {
      return setError("Passwords do not match!");
    }

    setLoading(true);

    // Strip confirmPassword before sending — server doesn't need it
    const { confirmPassword: _cp, ...registrationData } = formData;

    const res = await fetch("/api/profile/temp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registrationData),
    });

    if (!res.ok) {
      setLoading(false);
      const data = await res.json();
      return setError(data.error || "Failed to register. Username or email might be taken.");
    }

    const emailRes = await fetch("/api/email/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.email }),
    });

    if (emailRes.ok) {
      router.push(`/auth/verify?email=${formData.email}`);
    } else {
      const err = await emailRes.json();
      setError("Email failed to send: " + err.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F3F6] p-4 text-slate-800">
      <div className="bg-white p-10 md:p-12 rounded-[3rem] shadow-2xl w-full max-w-lg border border-white">
        <div className="flex justify-center mb-4 md:mb-5">
          <img src="/ipick-logo-navbar.png" alt="iPick Center" className="h-16 md:h-20 object-contain" />
        </div>

        <h1 className="text-3xl font-black mb-2 text-[#12A55C] uppercase text-center tracking-tighter">Create Account</h1>
        <p className="text-slate-400 mb-6 text-center text-sm font-medium">Join the iPick Center team board!</p>

        {error && (
          <div className="mb-6 bg-[#9E2A2B]/10 text-[#9E2A2B] text-[11px] leading-relaxed font-bold py-3 px-4 rounded-xl text-center border border-[#9E2A2B]/20 shadow-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input required placeholder="Full Name" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:border-[#12A55C] border-2 border-transparent transition-colors" onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <input required placeholder="Nickname" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:border-[#12A55C] border-2 border-transparent transition-colors" onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} />
          </div>
          <input required placeholder="Username" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:border-[#12A55C] border-2 border-transparent transition-colors" onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
          <input required type="email" placeholder="Email Address" className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:border-[#12A55C] border-2 border-transparent transition-colors" onChange={(e) => setFormData({ ...formData, email: e.target.value })} />

          <div className="grid grid-cols-2 gap-4">
            <div className="relative w-full">
              <input required type={showPassword ? "text" : "password"} placeholder="Password" className="w-full p-4 pr-12 bg-slate-50 rounded-2xl outline-none focus:border-[#12A55C] border-2 border-transparent transition-colors" onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#12A55C] transition-colors focus:outline-none">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <div className="relative w-full">
              <input required type={showConfirmPassword ? "text" : "password"} placeholder="Confirm" className="w-full p-4 pr-12 bg-slate-50 rounded-2xl outline-none focus:border-[#12A55C] border-2 border-transparent transition-colors" onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#12A55C] transition-colors focus:outline-none">
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button disabled={loading} type="submit" className="w-full bg-[#12A55C] text-white font-black py-5 rounded-[2rem] hover:bg-[#0e8549] transition-all uppercase tracking-widest text-sm shadow-xl shadow-[#12A55C]/20 disabled:bg-slate-300 mt-2">
            {loading ? "Sending Code..." : "Complete Registration"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-400">
          Already have an account? <Link href="/auth/signin" className="text-[#F37A22] font-bold hover:underline ml-1">Sign In</Link>
        </div>
      </div>
    </div>
  );
}