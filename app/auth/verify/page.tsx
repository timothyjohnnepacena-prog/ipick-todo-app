"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useModal } from "@/components/Modal";

function VerifyForm() {
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(30);
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get("email");
    const { showAlert } = useModal();

    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => setTimer(timer - 1), 1000);
            return () => clearInterval(interval);
        }
    }, [timer]);

    const handleResend = async () => {
        setTimer(30);
        await fetch("/api/profile/temp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, name: "", nickname: "", username: "", resendOnly: true }),
        });
        await fetch("/api/email/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
    };

    const handleVerify = async () => {
        setLoading(true);
        setError("");

        const res = await fetch("/api/auth/verify-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code }),
        });

        if (res.ok) {
            await showAlert({ title: "Registration Successful!", message: "Your account has been created. Please log in with your email and password.", variant: "success", buttonText: "Go to Login" });
            router.push("/auth/signin");
        } else {
            setError("Invalid code. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-md text-center border border-slate-100">
            <h1 className="text-3xl font-black tracking-tight mb-2">Verification</h1>
            <p className="text-slate-400 text-sm mb-8 font-medium italic">Sent to: {email}</p>

            <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full text-center text-4xl font-black tracking-[10px] p-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none mb-4"
            />

            {error && <p className="text-red-500 font-bold mb-4">{error}</p>}

            <button onClick={handleVerify} disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-slate-900 mb-6">
                {loading ? "Verifying..." : "Verify Code"}
            </button>

            <div className="pt-6 border-t border-slate-50">
                {timer > 0 ? (
                    <p className="text-xs text-slate-400">Resend code in <span className="font-bold text-blue-600">{timer}s</span></p>
                ) : (
                    <button onClick={handleResend} className="text-xs font-bold text-blue-600 uppercase tracking-widest hover:underline">Resend Verification Code</button>
                )}
            </div>
        </div>
    );
}

export default function VerifyPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] text-slate-800">
            <Suspense fallback={<div className="font-bold text-slate-400 animate-pulse">Loading Verification...</div>}>
                <VerifyForm />
            </Suspense>
        </div>
    );
}
