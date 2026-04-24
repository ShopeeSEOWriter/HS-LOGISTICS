import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Truck, Boxes, Scale, Headset, PlusCircle, ChevronRight, Menu, X, Settings } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface AdminSidebarProps {
  activeTab?: string;
}

export default function AdminSidebar({ activeTab }: AdminSidebarProps) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const isTabActive = (path: string) => {
    if (path === "/admin" && location.pathname === "/admin") return true;
    if (path !== "/admin" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        onClick={toggleSidebar}
        className="fixed top-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-highest text-on-surface shadow-xl md:hidden"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-on-surface/20 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-surface-container-low py-8 font-headline transition-transform duration-300 md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="mb-12 flex items-center gap-3 px-8">
          <div className="signature-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-black leading-none text-on-surface">HS</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Logistics</div>
            <div className="text-[8px] font-bold uppercase text-primary mt-1">和晟越南货运</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2">
          <SidebarLink 
            to="/ops" 
            icon={<LayoutDashboard className="h-5 w-5" />} 
            label="Bảng điều khiển" 
            subLabel="仪表盘" 
            active={isTabActive("/ops")} 
            onClick={() => setIsOpen(false)}
          />

          <div className="mt-8 mb-2 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-40">
            Quản lý / 管理
          </div>
          
          <SidebarLink 
            to="/admin/truck-history" 
            icon={<PlusCircle className="h-5 w-5" />} 
            label="Lịch sử xe hàng" 
            subLabel="车辆装载历史" 
            active={isTabActive("/admin/truck-history")} 
            onClick={() => setIsOpen(false)}
          />

          <SidebarLink 
            to="/admin/trucks" 
            icon={<Truck className="h-5 w-5" />} 
            label="Quản lý xe" 
            subLabel="车辆管理" 
            active={isTabActive("/admin/trucks")} 
            onClick={() => setIsOpen(false)}
          />
          <SidebarLink 
            to="/admin/translator" 
            icon={<Boxes className="h-5 w-5" />} 
            label="Dịch list xe" 
            subLabel="翻译货物清单" 
            active={isTabActive("/admin/translator")} 
            onClick={() => setIsOpen(false)}
          />
          <SidebarLink 
            to="/admin/settings" 
            icon={<Settings className="h-5 w-5" />} 
            label="Cấu hình hệ thống" 
            subLabel="系统设置" 
            active={isTabActive("/admin/settings")} 
            onClick={() => setIsOpen(false)}
          />

          <div className="mt-8 mb-2 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-40">
            Hỗ trợ / 支持
          </div>

          <SidebarLink 
            to="/support" 
            icon={<Headset className="h-5 w-5" />} 
            label="Hỗ trợ" 
            subLabel="客服支持" 
            active={location.pathname === "/support"} 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="my-4 h-[1px] w-full bg-surface-container mx-4 opacity-50" />
          
          <Link to="/" onClick={() => setIsOpen(false)} className="ml-2 flex items-center gap-4 rounded-l-2xl px-6 py-4 text-on-surface-variant hover:bg-surface-container transition-all">
            <div className="text-primary"><ChevronRight className="h-5 w-5 rotate-180" /></div>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-none">Trang chủ</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-tighter opacity-60">返回首页</span>
            </div>
          </Link>
        </nav>

      </aside>
    </>
  );
}

function SidebarLink({ icon, label, subLabel, active, to, onClick }: { icon: React.ReactNode, label: string, subLabel: string, active: boolean, to: string, onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className={cn(
      "ml-2 flex items-center gap-4 rounded-l-2xl px-6 py-4 transition-all",
      active ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container"
    )}>
      <div className={cn(active ? "text-primary" : "text-on-surface-variant/60")}>{icon}</div>
      <div className="flex flex-col">
        <span className="text-sm font-bold leading-none">{label}</span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-tighter opacity-60">{subLabel}</span>
      </div>
    </Link>
  );
}
