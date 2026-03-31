import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Package, Clock, Trash2, ChevronRight, Search, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";
import { format } from "date-fns";

export default function UserHistory() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/history");
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      } else {
        setError("Không thể tải lịch sử.");
      }
    } catch (err) {
      setError("Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (user) {
      fetchHistory();
    }
  }, [user, authLoading, navigate]);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (response.ok) {
        setHistory(history.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const filteredHistory = history.filter((item) =>
    item.tracking_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-surface">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-12">
      <div className="mb-12 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-headline text-4xl font-black tracking-tight text-on-surface">Lịch sử tra cứu</h1>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest opacity-40">My Tracking History / 我的历史</p>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-on-surface-variant/60">
            Lưu trữ các mã vận đơn bạn đã tra cứu trong 30 ngày qua.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/40" />
          <input
            type="text"
            placeholder="Tìm kiếm trong lịch sử..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-full border-none bg-surface-container-low py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {error && (
        <div className="mb-8 flex items-center gap-3 rounded-2xl bg-error/10 p-4 text-error">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[3rem] bg-surface-container-lowest p-24 text-center shadow-editorial">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-container shadow-inner">
            <Package className="h-10 w-10 text-on-surface-variant/20" />
          </div>
          <h3 className="font-headline text-2xl font-bold text-on-surface">Chưa có lịch sử tra cứu</h3>
          <p className="mt-2 text-sm text-on-surface-variant/60">Bắt đầu tra cứu mã vận đơn để lưu lại lịch sử tại đây.</p>
          <Link to="/" className="mt-8 rounded-full bg-on-background px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-95">
            Tra cứu ngay
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredHistory.map((item) => (
            <div key={item.id} className="group relative overflow-hidden rounded-[2.5rem] bg-surface-container-lowest p-8 shadow-editorial transition-all hover:bg-surface-bright hover:shadow-2xl">
              <div className="mb-6 flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container shadow-inner group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Package className="h-7 w-7" />
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="rounded-full p-2 text-on-surface-variant/40 transition-colors hover:bg-error/10 hover:text-error"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-1">
                <h3 className="font-headline text-2xl font-black text-on-surface">{item.tracking_code}</h3>
                <div className="inline-flex rounded-full bg-primary/10 px-3 py-0.5 text-[10px] font-bold text-primary">
                  {item.status}
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <div className="flex items-center gap-2 text-on-surface-variant/60">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-bold">
                    {format(new Date(item.last_checked_at), "dd/MM HH:mm")}
                  </span>
                </div>
                <Link
                  to={`/tracking/${item.tracking_code}`}
                  className="flex items-center gap-1 text-xs font-bold text-primary transition-all group-hover:translate-x-1"
                >
                  <span>Xem chi tiết</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
