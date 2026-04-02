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
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        
        // The AuthProvider's onAuthStateChanged will handle the state update
        navigate("/");
      } else {
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
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = "Đã có lỗi xảy ra. Vui lòng thử lại.";
      
      if (err.code === "auth/invalid-credential") {
        message = "Email hoặc mật khẩu không chính xác. LƯU Ý: Vì hệ thống vừa nâng cấp, bạn CẦN ĐĂNG KÝ LẠI tài khoản mới nếu chưa thực hiện trên giao diện này.";
      } else if (err.code === "auth/user-not-found") {
        message = "Không tìm thấy tài khoản với email này. Bạn có muốn đăng ký mới?";
      } else if (err.code === "auth/wrong-password") {
        message = "Mật khẩu không chính xác. Vui lòng thử lại hoặc đặt lại mật khẩu.";
      } else if (err.code === "auth/email-already-in-use") {
        message = "Email này đã được sử dụng. Chúng tôi đã chuyển bạn sang màn hình Đăng nhập.";
        setIsLogin(true); // Auto-switch to login
      } else if (err.code === "auth/weak-password") {
        message = "Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn (ít nhất 6 ký tự).";
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
      setError("Vui lòng nhập email để đặt lại mật khẩu.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError(null);
    } catch (err: any) {
      console.error("Reset error:", err);
      setError("Không thể gửi email đặt lại mật khẩu. Vui lòng kiểm tra lại email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md overflow-hidden rounded-[2.5rem] bg-surface-container-lowest shadow-editorial">
        <div className="bg-orange-600 p-12 text-center text-black">
          <h1 className="font-headline text-3xl font-black tracking-tight">
            {isLogin ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
          </h1>
          <p className="mt-2 text-sm font-medium opacity-80">
            {isLogin ? "Đăng nhập để quản lý lịch sử vận đơn" : "Đăng ký để bắt đầu theo dõi đơn hàng"}
          </p>
        </div>

        <div className="p-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Email</label>
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

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Mật khẩu</label>
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

            {error && (
              <div className="flex flex-col gap-3 rounded-2xl bg-error/10 p-4 text-error">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium leading-relaxed">{error}</span>
                </div>
                
                {/* Proactive actions based on error */}
                {isLogin && (error.includes("không chính xác") || error.includes("Không tìm thấy")) && (
                  <div className="flex flex-col gap-2 ml-8">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsLogin(false);
                        setError(null);
                      }}
                      className="text-xs font-black uppercase tracking-widest underline hover:opacity-80 transition-opacity text-left"
                    >
                      Thử Đăng ký tài khoản mới
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
                
                {!isLogin && error.includes("đã được sử dụng") && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsLogin(true);
                      setError(null);
                    }}
                    className="ml-8 text-xs font-black uppercase tracking-widest underline hover:opacity-80 transition-opacity text-left"
                  >
                    Chuyển sang Đăng nhập
                  </button>
                )}
              </div>
            )}

            {resetSent && (
              <div className="flex items-center gap-3 rounded-2xl bg-secondary/10 p-4 text-secondary">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Email đặt lại mật khẩu đã được gửi!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 py-4 text-sm font-bold text-black shadow-xl shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? "Đăng nhập" : "Đăng ký"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {isLogin && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-bold text-on-surface-variant/60 hover:text-primary transition-colors"
                >
                  Quên mật khẩu?
                </button>
              </div>
            )}
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-bold text-primary hover:underline"
            >
              {isLogin ? "Chưa có tài khoản? Đăng ký ngay" : "Đã có tài khoản? Đăng nhập"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
