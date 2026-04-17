import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings, ShieldCheck, Key, Save, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { getGeminiApiKey, updateGeminiApiKey } from "../services/settingsService";
import { useAuth } from "../hooks/useAuth";

export default function AdminSettings() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error", message: string } | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchKey = async () => {
      setLoading(true);
      try {
        const key = await getGeminiApiKey();
        if (key) setApiKey(key);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchKey();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await updateGeminiApiKey(apiKey);
      setStatus({ type: "success", message: "Đã cập nhật cấu hình API GEMINI AI!" });
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Lỗi khi cập nhật cấu hình." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <AdminSidebar activeTab="/admin/settings" />
      <main className="flex-1 p-6 md:p-12 pt-24 md:pt-12 ml-0 md:ml-64">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <Link 
              to="/admin" 
              className="inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-all hover:-translate-x-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại Dashboard</span>
            </Link>
          </div>

          <div className="mb-12">
            <h1 className="font-headline text-4xl font-black tracking-tight text-on-surface">
              Cấu hình hệ thống
              <span className="block text-2xl opacity-60">系统设置</span>
            </h1>
            <p className="mt-4 text-on-surface-variant font-medium">
              Quản lý các kết nối API và các tham số kỹ thuật toàn hệ thống. Cài đặt này sẽ áp dụng cho tất cả tài khoản.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <form onSubmit={handleSave} className="space-y-6">
                <div className="rounded-[2.5rem] bg-surface-container-lowest p-10 shadow-editorial border border-surface-container">
                  <div className="mb-8 flex items-center gap-4 border-b border-surface-container pb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Key className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-on-surface">Gemini AI API Key</h3>
                      <p className="text-xs font-bold uppercase tracking-widest text-primary">Artificial Intelligence Connection</p>
                    </div>
                  </div>

                  {status && (
                    <div className={`mb-8 flex items-center gap-3 rounded-2xl p-4 border ${
                      status.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-error/10 border-error/20 text-error"
                    }`}>
                      {status.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                      <span className="text-sm font-bold">{status.message}</span>
                    </div>
                  )}

                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase tracking-[0.1em] text-on-surface-variant/60">
                        Mã API Key
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Dán API Key từ Google AI Studio vào đây..."
                          className="w-full rounded-2xl border-none bg-surface-container-low p-5 text-sm font-medium focus:ring-2 focus:ring-primary shadow-inner"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/20">
                          <Settings className="h-5 w-5" />
                        </div>
                      </div>
                      <p className="text-[11px] leading-relaxed text-on-surface-variant/60 italic px-2">
                        * API Key này được sử dụng cho tính năng "Dịch thuật hàng hóa" và các tính năng AI khác. 
                        Sau khi lưu, tính năng này sẽ được kích hoạt cho mọi tài khoản nhân viên.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-surface-container-low p-6 border border-surface-container">
                      <div className="flex items-start gap-4">
                        <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-on-surface">Bảo mật cấp độ cao</h4>
                          <p className="text-xs text-on-surface-variant/60 leading-relaxed">
                            Khóa API được lưu trữ mã hóa trong cơ sở dữ liệu đám mây. Chỉ tài khoản Quản trị viên mới có quyền xem và chỉnh sửa thông tin này.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || saving}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-5 text-sm font-bold text-on-primary shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                          <span>Đang lưu cấu hình...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5" />
                          <span>Lưu cấu hình hệ thống</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] bg-surface-container-low p-8 border border-surface-container">
                <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-primary">Thông tin hữu ích</h4>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-on-surface">Lấy API Key ở đâu?</p>
                    <p className="text-xs text-on-surface-variant/60">
                      Bạn có thể tạo API Key miễn phí tại <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-primary hover:underline">Google AI Studio</a>.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-on-surface">Khi nào cần đổi Key?</p>
                    <p className="text-xs text-on-surface-variant/60">
                      Khi AI báo lỗi "Quota exceeded" hoặc bạn muốn sử dụng tài khoản Google khác để quản lý chi phí.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
