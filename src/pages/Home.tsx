import React, { useState, useEffect } from "react";
import { Package, Truck, ShieldCheck, Map, ArrowRight, ShoppingBag, Store, ShoppingCart, Clock, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import { useAuth } from "../hooks/useAuth";
import { saveTrackingHistory, getTrackingHistory } from "../services/historyService";

export default function Home() {
  const [trackingCode, setTrackingCode] = useState("");
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const fetchHistory = async () => {
        const history = await getTrackingHistory(user.id);
        setRecentHistory(history.slice(0, 3));
      };
      fetchHistory();
    }
  }, [user]);

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trackingCode.trim()) return;

    // Save to history if logged in
    if (user) {
      await saveTrackingHistory(user.id, trackingCode.trim());
    }

    navigate(`/tracking/${trackingCode.trim().toUpperCase().replace(/\s+/g, "")}`);
  };

  return (
    <div className="relative flex flex-col items-center overflow-hidden">
      {/* Abstract Background Pattern */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]">
        <img 
          src="https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&q=80&w=2000" 
          alt="Map Pattern"
          className="h-full w-full object-cover grayscale"
        />
      </div>

      {/* Decorative Grid Patterns */}
      <div className="grid-pattern pointer-events-none absolute -left-20 top-40 h-96 w-96 opacity-20" />
      <div className="grid-pattern pointer-events-none absolute -right-20 top-80 h-96 w-96 opacity-20" />
      <div className="grid-pattern pointer-events-none absolute left-1/4 bottom-20 h-64 w-64 opacity-10" />

      <main className="relative z-10 flex w-full flex-col items-center px-6 py-24">
        <div className="max-w-3xl text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-6xl"
          >
            <span className="block">Theo dõi vận đơn / 追踪您的货物</span>
            <span className="mt-2 block italic text-primary">Xuyên biên giới / 跨境物流</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-on-surface-variant"
          >
            <span className="block font-semibold">Tầm nhìn thời gian thực cho hàng hóa của bạn di chuyển qua hành lang Đông Hưng-Hà Nội.</span>
            <span className="mt-1 block text-sm opacity-80">为您在东兴-河内走廊运输的货物提供实时追踪。</span>
          </motion.p>

          {/* Tracking Input Card */}
          <motion.form 
            onSubmit={handleTrack}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-12 flex flex-col gap-2 rounded-2xl bg-surface-container-lowest p-2 shadow-editorial md:flex-row md:items-stretch"
          >
            <div className="relative flex flex-grow items-center px-4">
              <Package className="absolute left-6 h-5 w-5 text-on-surface-variant" />
              <input 
                type="text" 
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="Nhập mã vận đơn / 输入单号"
                className="w-full border-none bg-transparent py-5 pl-12 pr-4 text-lg font-medium placeholder:text-on-surface-variant/50 focus:ring-0"
              />
            </div>
            <button 
              type="submit"
              className="signature-gradient flex flex-col items-center justify-center rounded-xl px-10 py-4 font-headline font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              <div className="flex items-center gap-2">
                <span>Theo dõi đơn hàng</span>
                <ArrowRight className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-normal uppercase tracking-widest opacity-80">追踪订单</span>
            </button>
          </motion.form>

          {/* Recently Tracked */}
          {user && recentHistory.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 flex flex-col items-center gap-4"
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant/40">
                <Clock className="h-3 w-3" />
                <span>Tra cứu gần đây / 最近追踪</span>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {recentHistory.map((item) => (
                  <Link 
                    key={item.id}
                    to={`/tracking/${item.tracking_code}`}
                    className="flex items-center gap-3 rounded-full bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface-variant transition-all hover:bg-surface-container hover:text-primary"
                  >
                    <span>{item.tracking_code}</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Quick Links */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm">
            <span className="font-medium text-on-surface-variant/60">Liên kết nhanh / 快速链接:</span>
            <QuickLink icon={<ShoppingBag className="h-3 w-3" />} label="Taobao" />
            <QuickLink icon={<Store className="h-3 w-3" />} label="Shopee" />
            <QuickLink icon={<ShoppingCart className="h-3 w-3" />} label="Lazada" />
          </div>
        </div>

        {/* Features Bento */}
        <div className="mt-32 grid w-full max-w-7xl grid-cols-1 gap-8 md:grid-cols-3">
          <FeatureCard 
            icon={<Truck className="h-6 w-6" />}
            title="Vận chuyển tốc độ cao"
            subtitle="极速转运"
            description="Các tuyến hậu cần chuyên dụng đảm bảo hàng hóa của bạn di chuyển từ Trung tâm Đông Hưng đến Hà Nội trong thời gian kỷ lục."
            cnDescription="专用物流通道确保您的货物以创纪录的速度从东兴枢纽运抵河内。"
            color="bg-primary/10 text-primary"
          />
          <FeatureCard 
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Chuyên gia hải quan"
            subtitle="清关专家"
            description="Điều hướng các quy định biên giới phức tạp với việc nộp bản kê khai tự động và tuân thủ kỹ thuật số."
            cnDescription="通过自动舱单申报和数字化合规管理，轻松应对复杂的边境法规。"
            color="bg-secondary-container text-on-secondary-container"
          />
          <FeatureCard 
            icon={<Map className="h-6 w-6" />}
            title="Lộ trình thông minh"
            subtitle="路线智能"
            description="Định tuyến linh hoạt dựa trên lưu lượng biên giới và công suất kho bãi thời gian thực để đạt hiệu quả tối đa."
            cnDescription="基于实时边境流量和仓库容量进行动态路线规划，实现最大效率。"
            color="bg-surface-variant text-on-surface"
          />
        </div>
      </main>
    </div>
  );
}

function QuickLink({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <a href="#" className="group flex items-center gap-2 font-bold text-on-surface-variant transition-colors hover:text-primary">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-high transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        {icon}
      </div>
      {label}
    </a>
  );
}

function FeatureCard({ icon, title, subtitle, description, cnDescription, color }: any) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-surface-container-low p-8 transition-all hover:bg-surface-container">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", color)}>
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="font-headline text-xl font-bold leading-tight text-on-surface">{title}</h3>
        <p className="text-sm font-semibold opacity-60">{subtitle}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-on-surface-variant">{description}</p>
        <p className="text-[11px] leading-relaxed text-on-surface-variant/60">{cnDescription}</p>
      </div>
    </div>
  );
}
