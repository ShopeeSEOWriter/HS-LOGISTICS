import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { handleFirestoreError, OperationType } from "../lib/errorHandler";
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        navigate("/");
      } else if (mode === "signup") {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Create user document in Firestore
        const isAdmin = firebaseUser.email === "chichine153@gmail.com" || firebaseUser.email === "zadavn1@gmail.com";
        const userData = {
          email: firebaseUser.email,
          role: isAdmin ? "admin" : "user",
          created_at: new Date().toISOString(),
        };
        await setDoc(doc(db, "users", firebaseUser.email!), userData);
        
        navigate("/");
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        setSuccess("Email đặt lại mật khẩu đã được gửi! Vui lòng kiểm tra hòm thư của bạn.");
      }
    } catch (err: any) {
      if (err.code?.startsWith("auth/")) {
        console.error("Auth error:", err);
      } else {
        handleFirestoreError(err, OperationType.WRITE, `users/${email}`);
      }
      
      let message = "Đã có lỗi xảy ra. Vui lòng thử lại.";
      
      switch (err.code) {
        case "auth/invalid-credential":
          message = "Email hoặc mật khẩu không chính xác.";
          break;
        case "auth/user-not-found":
          message = "Không tìm thấy tài khoản với email này.";
          break;
        case "auth/wrong-password":
          message = "Mật khẩu không chính xác.";
          break;
        case "auth/email-already-in-use":
          message = "Email này đã được sử dụng. Vui lòng đăng nhập.";
          setMode("login");
          break;
        case "auth/weak-password":
          message = "Mật khẩu quá yếu (tối thiểu 6 ký tự).";
          break;
        case "auth/too-many-requests":
          message = "Thử lại quá nhiều lần. Vui lòng đợi một lát.";
          break;
        case "auth/invalid-email":
          message = "Định dạng email không hợp lệ.";
          break;
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md overflow-hidden rounded-[2.5rem] bg-surface-container-lowest shadow-editorial">
        <div className={cn(
          "p-12 text-center transition-colors duration-500",
          mode === "signup" ? "bg-primary text-on-primary" : "bg-orange-600 text-black"
        )}>
          <h1 className="font-headline text-3xl font-black tracking-tight">
            {mode === "login" && (
              <>
                <span>Chào mừng trở lại</span>
                <span className="block text-xl opacity-60">欢迎回来</span>
              </>
            )}
            {mode === "signup" && (
              <>
                <span>Tạo tài khoản mới</span>
                <span className="block text-xl opacity-60">创建新账户</span>
              </>
            )}
            {mode === "forgot" && (
              <>
                <span>Khôi phục mật khẩu</span>
                <span className="block text-xl opacity-60">找回密码</span>
              </>
            )}
          </h1>
          <p className="mt-2 text-sm font-medium opacity-80">
            {mode === "login" && "Đăng nhập để quản lý lịch sử vận đơn"}
            {mode === "signup" && "Đăng ký để bắt đầu theo dõi đơn hàng"}
            {mode === "forgot" && "Nhập email để nhận liên kết đặt lại mật khẩu"}
          </p>
        </div>

        <div className="p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Email / 电子邮件</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant/40" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-2xl border-none bg-surface-container-low py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Mật khẩu / 密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant/40" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border-none bg-surface-container-low py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-2xl bg-error/10 p-4 text-error animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="text-sm font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 p-4 text-emerald-600 animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="text-sm font-medium leading-relaxed">{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-1 rounded-full py-4 text-sm font-bold shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50",
                mode === "signup" ? "bg-primary text-on-primary shadow-primary/20" : "bg-orange-500 text-black shadow-orange-500/20"
              )}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span>
                      {mode === "login" ? "Đăng nhập" : mode === "signup" ? "Đăng ký" : "Gửi yêu cầu"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-normal opacity-70">
                    {mode === "login" ? "登录" : mode === "signup" ? "注册" : "发送请求"}
                  </span>
                </>
              )}
            </button>

            {mode === "login" && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-xs font-bold text-on-surface-variant/60 hover:text-primary transition-colors"
                >
                  Quên mật khẩu? / 忘记密码？
                </button>
              </div>
            )}
          </form>

          <div className="mt-8 border-t border-surface-container pt-8 text-center">
            {mode === "login" ? (
              <button
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-sm font-bold text-primary hover:underline transition-all"
              >
                <span>Chưa có tài khoản? Đăng ký ngay</span>
                <span className="ml-2 opacity-60">没有账户？立即注册</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-sm font-bold text-on-surface-variant hover:text-primary transition-all"
              >
                <span>Đã có tài khoản? Đăng nhập ngay</span>
                <span className="ml-2 opacity-60">已有账户？立即登录</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
