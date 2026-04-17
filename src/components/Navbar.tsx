import React from "react";
import { Link, useLocation } from "react-router-dom";
import { User, Bell, HelpCircle, Search, Menu, Package, LogOut, History as HistoryIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import NotificationDropdown from "./NotificationDropdown";

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isOps = location.pathname.startsWith("/ops") || location.pathname.startsWith("/admin");
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", user.id),
      where("read_status", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <nav className={cn(
      "sticky top-0 z-50 w-full border-b border-surface-container/50 bg-surface/80 backdrop-blur-xl transition-all duration-300",
      isOps && "md:ml-64 md:w-[calc(100%-16rem)]"
    )}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-8">
        <div className="flex items-center gap-8">
          {!isOps && (
            <Link to="/" className="flex flex-col">
              <span className="font-headline text-xl font-black uppercase tracking-tighter text-primary leading-none">
                HS Logistics
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
                和晟越南货运
              </span>
            </Link>
          )}
          
          {isOps ? (
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <h1 className="font-headline text-lg font-black leading-none text-on-surface">
                  {location.pathname.startsWith("/admin") ? "Quản trị hệ thống" : "Cổng điều hành"}
                </h1>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {location.pathname.startsWith("/admin") ? "系统管理" : "运营门户网站"}
                </span>
              </div>
              <div className="relative hidden w-80 md:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm vận đơn hoặc khách hàng / 搜索单号 hoặc 客户..."
                  className="w-full rounded-full border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary-container"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim().toUpperCase().replace(/\s+/g, "");
                      if (val) {
                        window.location.href = `/tracking/${val}`;
                      }
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="hidden items-center gap-8 md:flex">
              <NavLink to="/" active={location.pathname === "/"}>
                <span>Theo dõi</span>
                <span className="text-[10px] opacity-70">追踪</span>
              </NavLink>
              <NavLink to="/history" active={location.pathname === "/history"}>
                <span>Lịch sử</span>
                <span className="text-[10px] opacity-70">历史</span>
              </NavLink>
              <NavLink to="/calculator" active={location.pathname === "/calculator"}>
                <span>Tính giá</span>
                <span className="text-[10px] opacity-70">运费计算</span>
              </NavLink>
              <NavLink to="/support" active={location.pathname === "/support"}>
                <span>Hỗ trợ</span>
                <span className="text-[10px] opacity-70">帮助</span>
              </NavLink>
              <NavLink to="/admin/trucks" active={location.pathname.startsWith("/admin")}>
                <span>Quản trị</span>
                <span className="text-[10px] opacity-70">管理</span>
              </NavLink>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isOps && (
            <div className="hidden items-center gap-2 rounded-full bg-primary/10 px-3 py-1 font-bold text-primary md:flex">
              <Bell className="h-3 w-3 fill-current" />
              <span className="text-[10px] uppercase">Cảnh báo toàn cầu / 全球警报</span>
            </div>
          )}
          <div className="flex items-center gap-4 text-on-surface-variant">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative hover:text-primary transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white ring-2 ring-surface">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && user && (
                <NotificationDropdown 
                  userId={user.id} 
                  onClose={() => setShowNotifications(false)} 
                />
              )}
            </div>
            <button className="hover:text-primary transition-colors">
              <HelpCircle className="h-5 w-5" />
            </button>
            <div className="h-8 w-[1px] bg-surface-container mx-2" />
            
            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 focus:outline-none"
                >
                <div className="hidden text-right md:block">
                  <div className="text-xs font-bold text-on-surface">{user.email}</div>
                  <div className="text-[9px] uppercase tracking-tighter text-on-surface-variant">
                    {user.role === "admin" ? (
                      <>
                        <span>Quản trị viên</span>
                        <span className="ml-1 opacity-60">管理员</span>
                      </>
                    ) : (
                      <>
                        <span>Thành viên</span>
                        <span className="ml-1 opacity-60">会员</span>
                      </>
                    )}
                  </div>
                </div>
                  <div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-primary/10 bg-primary/5 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-4 w-56 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2">
                      <Link 
                        to="/history" 
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all"
                      >
                        <HistoryIcon className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span>Lịch sử tra cứu</span>
                          <span className="text-[10px] opacity-60">查询历史</span>
                        </div>
                      </Link>
                      <button 
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-error hover:bg-error/10 transition-all"
                      >
                        <LogOut className="h-4 w-4" />
                        <div className="flex flex-col items-start">
                          <span>Đăng xuất</span>
                          <span className="text-[10px] opacity-60">退出登录</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                to="/auth" 
                className="flex flex-col items-center rounded-full bg-orange-500 px-6 py-2 text-xs font-bold text-black shadow-lg transition-all hover:bg-orange-600 active:scale-95"
              >
                <span>Đăng nhập</span>
                <span className="text-[9px] opacity-70">登录</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, active, children }: { to: string, active: boolean, children: React.ReactNode }) {
  return (
    <Link 
      to={to} 
      className={cn(
        "flex flex-col items-center text-sm font-medium transition-colors hover:text-primary",
        active ? "border-b-2 border-primary font-extrabold text-primary" : "text-on-surface-variant"
      )}
    >
      {children}
    </Link>
  );
}
