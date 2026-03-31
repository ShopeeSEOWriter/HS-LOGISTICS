import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { Truck, Lock, User, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/admin");
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
      >
        <div className="bg-primary p-12 text-center text-white relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-4 left-4 w-12 h-12 border-2 border-white rounded-full" />
            <div className="absolute bottom-8 right-8 w-24 h-24 border-4 border-white rounded-full" />
          </div>
          
          <div className="inline-flex bg-white/20 p-4 rounded-2xl mb-6 backdrop-blur-sm">
            <Truck className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">ADMIN PORTAL</h1>
          <p className="text-white/70 font-bold uppercase tracking-widest text-xs">HS Logistics - 和晟越南货运</p>
        </div>

        <div className="p-12">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex items-center gap-3 mb-8 text-sm font-bold">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Email Address</label>
              <div className="relative group">
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@logistics.com"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-primary focus:ring-0 transition-all font-bold text-slate-900"
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5 group-focus-within:text-primary transition-colors" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Password</label>
              <div className="relative group">
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-primary focus:ring-0 transition-all font-bold text-slate-900"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5 group-focus-within:text-primary transition-colors" />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-5 rounded-xl font-black text-lg shadow-xl shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Authorized Personnel Only</p>
            <div className="mt-4 flex justify-center gap-4">
              <div className="h-1 w-8 bg-slate-100 rounded-full" />
              <div className="h-1 w-8 bg-slate-100 rounded-full" />
              <div className="h-1 w-8 bg-slate-100 rounded-full" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
