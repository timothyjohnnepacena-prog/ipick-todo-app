"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

export default function SignInPage() {
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const res = await signIn("credentials", {
            identifier,
            password,
            redirect: false,
        });

        if (res?.error) {
            setError("Invalid login credentials");
            setLoading(false);
        } else {
            router.push("/");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F1F3F6] p-4 text-slate-800">
            <div className="bg-white p-10 md:p-12 rounded-[3rem] shadow-2xl w-full max-w-md border border-white">
                <div className="flex justify-center mb-6">
                    <img src="/ipick-logo-navbar.png" alt="iPick Center" className="h-20 object-contain" />
                </div>

                <h1 className="text-3xl font-black mb-2 text-[#12A55C] uppercase text-center tracking-tighter">Welcome Back</h1>
                <p className="text-slate-400 mb-8 text-center text-sm font-medium">Log in to manage your team tasks</p>

                {error && (
                    <div className="mb-6 bg-[#9E2A2B]/10 text-[#9E2A2B] text-xs font-bold py-3 px-4 rounded-xl text-center border border-[#9E2A2B]/20">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <input
                            type="text"
                            placeholder="Email or Username"
                            className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:border-[#12A55C] border-2 border-transparent transition-colors"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required
                        />
                    </div>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            className="w-full p-4 pr-12 bg-slate-50 rounded-2xl outline-none focus:border-[#12A55C] border-2 border-transparent transition-colors"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#12A55C] transition-colors"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    <div className="flex justify-end text-xs">
                        <Link href="/auth/forgot-password" className="text-[#F37A22] font-bold hover:underline">
                            Forgot Password?
                        </Link>
                    </div>

                    <button
                        disabled={loading}
                        type="submit"
                        className="w-full bg-[#12A55C] text-white font-black py-5 rounded-[2rem] hover:bg-[#0e8549] transition-all uppercase tracking-widest text-sm shadow-xl shadow-[#12A55C]/20 disabled:bg-slate-300"
                    >
                        {loading ? "Signing In..." : "Log In"}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-400">
                    Don&apos;t have an account?
                    <Link href="/register" className="text-[#F37A22] font-bold hover:underline ml-1">Sign Up</Link>
                </div>
            </div>
        </div>
    );
}
