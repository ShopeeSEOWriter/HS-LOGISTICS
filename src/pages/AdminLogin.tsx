import React, { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { handleFirestoreError, OperationType } from "@/src/lib/errorHandler";
import { Truck, Lock, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Check if user is admin in Firestore
      const userDoc = await getDoc(doc(db, "users", firebaseUser.email!));
      const userData = userDoc.data();
      
      // Allow if role is admin OR if it's one of the bootstrap admin emails
      if (userData?.role === "admin" || 
          firebaseUser.email === "chichine153@gmail.com" || 
          firebaseUser.email === "zadavn1@gmail.com") {
        navigate("/admin");
      } else {
        await auth.signOut();
        setError("Access denied. You do not have admin privileges.");
      }
    } catch (err: any) {
      if (err.code?.startsWith("auth/")) {
        console.error("Login error:", err);
      } else {
        handleFirestoreError(err, OperationType.GET, `users/${email}`);
      }
      
      let message = "Email hoặc mật khẩu không chính xác. Vui lòng thử lại.";
      
      if (err.code === "auth/invalid-credential") {
        message = "Email hoặc mật khẩu không chính xác. LƯU Ý: Vì hệ thống vừa nâng cấp, bạn CẦN ĐĂNG KÝ LẠI tài khoản mới nếu chưa thực hiện trên giao diện này.";
      } else if (err.code === "auth/user-not-found") {
        message = "Không tìm thấy tài khoản quản trị với email này. Vui lòng kiểm tra lại.";
      } else if (err.code === "auth/wrong-password") {
        message = "Mật khẩu không chính xác. Bạn có thể đặt lại mật khẩu bên dưới.";
      } else if (err.code === "auth/too-many-requests") {
        message = "Quá nhiều lần thử thất bại. Vui lòng thử lại sau vài phút.";
      } else if (err.code === "auth/invalid-email") {
        message = "Định dạng email không hợp lệ.";
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email to reset password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError("");
    } catch (err: any) {
      console.error("Reset error:", err);
      setError("Failed to send reset email. Please check your email address.");
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
        <div className="bg-orange-600 p-12 text-center text-black relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-4 left-4 w-12 h-12 border-2 border-black rounded-full" />
            <div className="absolute bottom-8 right-8 w-24 h-24 border-4 border-black rounded-full" />
          </div>
          
          <div className="inline-flex bg-black/10 p-4 rounded-2xl mb-6 backdrop-blur-sm">
            <Truck className="h-10 w-10 text-black" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">ADMIN PORTAL</h1>
          <p className="text-black/70 font-bold uppercase tracking-widest text-xs">HS Logistics - 和晟越南货运</p>
        </div>

        <div className="p-12">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error p-4 rounded-xl flex flex-col gap-3 mb-8 text-sm font-bold">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{error}</p>
              </div>
              
              {/* Proactive actions */}
              {error.includes("không chính xác") && (
                <div className="flex flex-col gap-2 ml-8">
                  <button 
                    type="button"
                    onClick={() => {
                      navigate("/auth");
                    }}
                    className="text-xs font-black uppercase tracking-widest underline hover:opacity-80 transition-opacity text-left"
                  >
                    Chuyển sang Đăng ký tài khoản mới
                  </button>
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-black uppercase tracking-widest underline hover:opacity-80 transition-opacity text-left text-primary"
                  >
                    Đặt lại mật khẩu (Quên mật khẩu)
                  </button>
                </div>
              )}
            </div>
          )}

          {resetSent && (
            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-center gap-3 mb-8 text-sm font-bold">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p>Password reset email sent!</p>
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
              className="w-full bg-orange-500 text-black py-5 rounded-xl font-black text-lg shadow-xl shadow-orange-500/20 hover:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors"
              >
                Forgot Password?
              </button>
            </div>
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
