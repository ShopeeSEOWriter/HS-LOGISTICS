import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Truck, Boxes, Scale, Headset, PlusCircle, ChevronRight, Languages } from "lucide-react";
import { cn } from "../lib/utils";

interface AdminSidebarProps {
  activeTab?: string;
}

export default function AdminSidebar({ activeTab }: AdminSidebarProps) {
  const location = useLocation();

  const isTabActive = (path: string) => {
    if (path === "/admin" && location.pathname === "/admin") return true;
    if (path !== "/admin" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-surface-container-low py-8 font-headline">
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

      <nav className="flex-1 space-y-1">
        <SidebarLink 
          to="/admin" 
          icon={<LayoutDashboard className="h-5 w-5" />} 
          label="Bảng điều khiển" 
          subLabel="仪表盘" 
          active={isTabActive("/admin") && location.pathname === "/admin"} 
        />
        <SidebarLink 
          to="/admin/trucks" 
          icon={<Truck className="h-5 w-5" />} 
          label="Quản lý xe" 
          subLabel="车辆管理" 
          active={isTabActive("/admin/trucks")} 
        />
        <SidebarLink 
          to="/admin/translator" 
          icon={<Boxes className="h-5 w-5" />} 
          label="Dịch list xe" 
          subLabel="翻译车单" 
          active={isTabActive("/admin/translator")} 
        />
        <SidebarLink 
          to="#" 
          icon={<Scale className="h-5 w-5" />} 
          label="Hải quan" 
          subLabel="海关" 
          active={false} 
        />
        <SidebarLink 
          to="/support" 
          icon={<Headset className="h-5 w-5" />} 
          label="Hỗ trợ" 
          subLabel="支持" 
          active={location.pathname === "/support"} 
        />
        
        <div className="my-4 h-[1px] w-full bg-surface-container mx-4 opacity-50" />
        
        <Link to="/" className="ml-2 flex items-center gap-4 rounded-l-2xl px-6 py-4 text-on-surface-variant hover:bg-surface-container transition-all">
          <div className="text-primary"><ChevronRight className="h-5 w-5 rotate-180" /></div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none">Trang chủ</span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-tighter opacity-60">返回首页</span>
          </div>
        </Link>
      </nav>

      <div className="mt-auto px-4">
        <Link to="/admin/trucks" className="signature-gradient flex w-full flex-col items-center justify-center rounded-2xl py-4 font-bold text-on-primary shadow-xl transition-opacity hover:opacity-90">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            <span className="text-xs">Tạo vận đơn mới</span>
          </div>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-widest opacity-80">新建货运单</span>
        </Link>
      </div>
    </aside>
  );
}

function SidebarLink({ icon, label, subLabel, active, to }: { icon: React.ReactNode, label: string, subLabel: string, active: boolean, to: string }) {
  return (
    <Link to={to} className={cn(
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
