import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Package, History, Scale, HelpCircle, LayoutDashboard, User } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";

export default function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  
  // Always show Basic nav, check role only for Admin tab
  const isAdmin = user?.role === "admin";

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-[92%] -translate-x-1/2 md:hidden">
      <div className="flex items-center justify-around gap-1 rounded-full border border-surface-container bg-surface/90 p-2 shadow-2xl backdrop-blur-2xl">
        <NavItem 
          to="/" 
          icon={<Package className="h-5 w-5" />} 
          active={location.pathname === "/"} 
          label="Tra cứu"
          subLabel="追踪"
        />
        <NavItem 
          to="/history" 
          icon={<History className="h-5 w-5" />} 
          active={location.pathname === "/history"} 
          label="Lịch sử"
          subLabel="历史"
        />
        <NavItem 
          to="/calculator" 
          icon={<Scale className="h-5 w-5" />} 
          active={location.pathname === "/calculator"} 
          label="Tính giá"
          subLabel="口径"
        />
        <NavItem 
          to="/support" 
          icon={<HelpCircle className="h-5 w-5" />} 
          active={location.pathname === "/support"} 
          label="Hỗ trợ"
          subLabel="帮助"
        />
        
        {user ? (
          isAdmin && (
            <NavItem 
              to="/admin/trucks" 
              icon={<LayoutDashboard className="h-5 w-5" />} 
              active={location.pathname.startsWith("/admin") || location.pathname === "/ops"} 
              label="Quản trị"
              subLabel="管理"
              highlight
            />
          )
        ) : (
          <NavItem 
            to="/auth" 
            icon={<User className="h-5 w-5" />} 
            active={location.pathname === "/auth"} 
            label="Đăng nhập"
            subLabel="登录"
          />
        )}
      </div>
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  active: boolean;
  label: string;
  subLabel: string;
  highlight?: boolean;
}

function NavItem({ to, icon, active, label, subLabel, highlight }: NavItemProps) {
  return (
    <Link 
      to={to} 
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-full px-3 py-2 transition-all duration-300",
        active 
          ? (highlight ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30" : "text-primary scale-110")
          : "text-on-surface-variant hover:bg-on-surface/5"
      )}
    >
      <div className={cn("relative", active && !highlight && "text-primary")}>
        {icon}
        {active && !highlight && (
          <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
        )}
      </div>
      <span className={cn("text-[8px] font-black uppercase tracking-tighter", active ? "block" : "hidden")}>
        {label}
      </span>
      <span className={cn("text-[7px] font-bold opacity-60", active ? "block" : "hidden")}>
        {subLabel}
      </span>
    </Link>
  );
}
