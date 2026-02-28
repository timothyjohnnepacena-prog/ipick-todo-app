// app/register/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Register() {
  const [formData, setFormData] = useState({ name: "", username: "", email: "", password: "" });
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      // 1. Generate code and temporarily save user
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      const tempRes = await fetch("/api/profile/temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, verificationCode: code }),
      });

      const tempResult = await tempRes.json();
      if (!tempRes.ok) throw new Error(tempResult.error || "Failed to save registration data.");

      // 2. Attempt to send the email code
      const emailRes = await fetch("/api/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, verificationCode: code }),
      });

      // 3. Catch Rate Limiting (429) or other errors
      if (emailRes.status === 429) {
        setMessage({ text: "⚠️ You have reached the limit for sending verification codes. Please wait a few minutes and try again.", type: "error" });
        setLoading(false);
        return;
      }

      if (!emailRes.ok) throw new Error("Failed to send verification email. Please check your email configuration.");

      // 4. Success -> Redirect to verification page
      router.push(`/auth/verify?email=${encodeURIComponent(formData.email)}`);

    } catch (error) {
      setMessage({ text: error.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold text-center text-gray-800">Create Account</h2>
        
        {message.text && (
          <div className={`p-4 text-sm rounded-md text-center border ${
            message.type === "error" ? "text-red-800 bg-red-100 border-red-300" : "text-green-800 bg-green-100 border-green-300"
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            type="text"
            name="username"
            placeholder="Username"
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            onChange={handleChange}
            required
            minLength={6}
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Processing..." : "Register & Send Code"}
          </button>
        </form>
        
        <div className="text-center text-sm text-gray-600">
          <p>Already have an account? <Link href="/auth/signin" className="text-blue-600 hover:underline font-semibold">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}