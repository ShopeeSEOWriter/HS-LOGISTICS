import { LayoutDashboard, Truck, Boxes, Scale, Headset, PlusCircle, Search, Bell, HelpCircle, Upload, Edit, ChevronRight, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
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
          <SidebarLink icon={<LayoutDashboard className="h-5 w-5" />} label="Bảng điều khiển" subLabel="仪表盘" active />
          <SidebarLink icon={<Truck className="h-5 w-5" />} label="Vận chuyển" subLabel="发货" />
          <SidebarLink icon={<Boxes className="h-5 w-5" />} label="Kho hàng" subLabel="库存" />
          <SidebarLink icon={<Scale className="h-5 w-5" />} label="Hải quan" subLabel="海关" />
          <SidebarLink icon={<Headset className="h-5 w-5" />} label="Hỗ trợ" subLabel="支持" />
          
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
          <button className="signature-gradient flex w-full flex-col items-center justify-center rounded-2xl py-4 font-bold text-on-primary shadow-xl transition-opacity hover:opacity-90">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              <span className="text-xs">Tạo vận đơn mới</span>
            </div>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-widest opacity-80">新建货运单</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative ml-64 flex-1 p-8 pt-24">
        {/* Background Decorative Grids */}
        <div className="grid-pattern pointer-events-none absolute left-0 top-0 h-full w-full opacity-[0.01]" />
        <div className="grid-pattern pointer-events-none absolute -right-10 top-40 h-64 w-64 opacity-10" />
        <div className="grid-pattern pointer-events-none absolute -left-10 bottom-40 h-80 w-80 opacity-10" />

        {/* Summary Cards */}
        <div className="relative z-10 mb-12 grid grid-cols-1 gap-6 md:grid-cols-5">
          <SummaryCard title="Tổng đơn hàng" subTitle="订单总数" value="42,500" trend="+12% SO VỚI THÁNG TRƯỚC" />
          <SummaryCard title="Tại Trung Quốc" subTitle="在中国" value="8,420" progress={25} />
          <SummaryCard title="Tại Hải Quan" subTitle="海关检查中" value="1,205" status="warning" />
          <SummaryCard title="Tại Việt Nam" subTitle="在越南" value="15,200" progress={60} />
          <SummaryCard title="Đã giao hàng" subTitle="已送达" value="17,675" status="success" />
        </div>

        <div className="flex gap-8">
          {/* Table Section */}
          <div className="flex-1 overflow-hidden rounded-2xl bg-surface-container-lowest shadow-editorial">
            <div className="flex items-center justify-between border-b border-surface-container-low p-8">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-2xl font-black">Danh sách vận đơn</h2>
                  <span className="text-sm font-bold text-on-surface-variant/50">/ 活跃货单</span>
                </div>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                  Đang giám sát 248 đơn hàng đang vận chuyển. / 正在监控 248 个运输中的货单。
                </p>
              </div>
              <div className="flex gap-3">
                <TableAction icon={<Upload className="h-4 w-4" />} label="Nhập từ Sheets" subLabel="从表格导入" />
                <TableAction icon={<Edit className="h-4 w-4" />} label="Cập nhật hàng loạt" subLabel="批量更新" primary />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low/50">
                  <tr>
                    <TableHeader label="Mã vận đơn" subLabel="跟踪代码" />
                    <TableHeader label="Khách hàng" subLabel="客户" />
                    <TableHeader label="Khối lượng / Phí" subLabel="重量 / 费用" />
                    <TableHeader label="Trạng thái" subLabel="状态" />
                    <TableHeader label="Vị trí" subLabel="位置" />
                    <TableHeader label="Cập nhật cuối" subLabel="最后更新" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/30">
                  <TableRow 
                    id="VN987654321" batch="BATCH-A29-DX" 
                    customer="Nguyen Tran H." tier="Premium Tier"
                    weight="1.5kg" fee="150,000 VND"
                    status="Đang vận chuyển - TQ" cnStatus="运输中 - 中国"
                    location="Dongxing / 东兴" time="Today, 10:30 AM"
                  />
                  <TableRow 
                    id="VN987654355" batch="BATCH-B01-SZ" 
                    customer="Tran Van B." tier="Standard Tier"
                    weight="12.2kg" fee="840,000 VND"
                    status="Cảnh báo Hải quan" cnStatus="海关警报"
                    location="Pingxiang Border" time="Delayed (24h)"
                    isWarning
                  />
                  <TableRow 
                    id="VN987654388" batch="BATCH-A29-DX" 
                    customer="Le My Linh" tier="VIP Member"
                    weight="0.8kg" fee="65,000 VND"
                    status="Đang phân loại tại VN" cnStatus="越南分拣中"
                    location="Hanoi WH / 河内仓库" time="Today, 09:15 AM"
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Controls Panel */}
          <aside className="w-96 shrink-0 space-y-6">
            <div className="sticky top-24 overflow-hidden rounded-2xl bg-surface-container-lowest shadow-editorial">
              <div className="signature-gradient p-8 text-on-primary">
                <h3 className="font-headline text-xl font-bold">Điều phối luồng hàng</h3>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-80">Cập nhật trạng thái đơn hàng / 更新货单状态</p>
              </div>
              <div className="max-h-[600px] overflow-y-auto p-8 no-scrollbar">
                <ControlSection title="Đông Hưng / 东兴运营">
                  <ControlButton label="Người bán đã gửi hàng" subLabel="卖家已发货" />
                  <ControlButton label="Đã nhập kho Trung Quốc" subLabel="中国仓库已收货" />
                  <ControlButton label="Đang phân loại tại TQ" subLabel="中国分拣中" active />
                  <ControlButton label="Đã đóng gói" subLabel="已打包" />
                </ControlSection>
                
                <ControlSection title="Biên giới & Hải quan / 跨境与海关">
                  <ControlButton label="Vận chuyển biên giới" subLabel="跨境运输中" />
                  <ControlButton label="Đang thông quan" subLabel="海关清关中" isError />
                </ControlSection>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SidebarLink({ icon, label, subLabel, active }: any) {
  return (
    <a href="#" className={cn(
      "ml-2 flex items-center gap-4 rounded-l-2xl px-6 py-4 transition-all",
      active ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container"
    )}>
      <div className={cn(active ? "text-primary" : "text-on-surface-variant/60")}>{icon}</div>
      <div className="flex flex-col">
        <span className="text-sm font-bold leading-none">{label}</span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-tighter opacity-60">{subLabel}</span>
      </div>
    </a>
  );
}

function SummaryCard({ title, subTitle, value, trend, progress, status }: any) {
  return (
    <div className={cn(
      "rounded-2xl bg-surface-container-lowest p-6 shadow-editorial transition-colors hover:bg-surface-bright",
      status === "warning" && "border-l-4 border-error",
      status === "success" && "border-l-4 border-secondary-container"
    )}>
      <div className={cn("text-[10px] font-bold uppercase tracking-widest leading-tight", status === "warning" ? "text-error" : "text-on-surface-variant")}>
        {title}
      </div>
      <div className={cn("mt-1 text-[9px] font-bold uppercase tracking-tight opacity-60", status === "warning" && "text-error/80")}>{subTitle}</div>
      <div className={cn("mt-4 font-headline text-3xl font-black", status === "warning" && "text-error")}>{value}</div>
      
      {trend && (
        <div className="mt-4 flex items-center gap-1 text-[9px] font-bold text-secondary">
          <PlusCircle className="h-3 w-3" />
          <span>{trend}</span>
        </div>
      )}
      
      {progress !== undefined && (
        <div className="mt-6 h-1 w-full rounded-full bg-surface-container overflow-hidden">
          <div className={cn("h-full rounded-full", status === "success" ? "bg-secondary-container" : "bg-primary")} style={{ width: `${progress}%` }} />
        </div>
      )}

      {status === "success" && (
        <div className="mt-4 inline-block rounded bg-secondary-container/50 px-2 py-1 text-[9px] font-bold uppercase text-on-secondary-container">
          Hoàn tất hành trình
        </div>
      )}
    </div>
  );
}

function TableHeader({ label, subLabel }: any) {
  return (
    <th className="px-8 py-5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</div>
      <div className="text-[8px] font-bold uppercase tracking-tighter opacity-40">{subLabel}</div>
    </th>
  );
}

function TableRow({ id, batch, customer, tier, weight, fee, status, cnStatus, location, time, isWarning }: any) {
  return (
    <tr className={cn("transition-colors hover:bg-surface-bright", isWarning && "bg-error/5 hover:bg-error/10")}>
      <td className="px-8 py-6">
        <div className="font-bold text-primary">{id}</div>
        <div className="text-[10px] font-medium text-on-surface-variant opacity-60">{batch}</div>
      </td>
      <td className="px-8 py-6">
        <div className="font-bold">{customer}</div>
        <div className="text-[10px] font-medium text-on-surface-variant opacity-60">{tier}</div>
      </td>
      <td className="px-8 py-6">
        <div className="font-bold">{weight}</div>
        <div className="text-[10px] font-medium text-secondary">{fee}</div>
      </td>
      <td className="px-8 py-6">
        <div className={cn(
          "inline-flex flex-col rounded-full px-4 py-1 text-[9px] font-bold leading-tight",
          isWarning ? "bg-error text-white shadow-sm" : "bg-primary/10 text-primary"
        )}>
          <span>{status}</span>
          <span className="text-[8px] opacity-70">{cnStatus}</span>
        </div>
      </td>
      <td className={cn("px-8 py-6 font-bold", isWarning && "text-error")}>{location}</td>
      <td className={cn("px-8 py-6 text-xs", isWarning ? "font-bold text-error" : "text-on-surface-variant")}>{time}</td>
    </tr>
  );
}

function TableAction({ icon, label, subLabel, primary }: any) {
  return (
    <button className={cn(
      "flex flex-col items-center rounded-xl px-5 py-2 transition-all active:scale-95",
      primary ? "bg-on-background text-white hover:opacity-90" : "bg-surface-container text-on-surface hover:bg-surface-variant"
    )}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-bold">{label}</span>
      </div>
      <span className="mt-0.5 text-[8px] font-bold uppercase tracking-tighter opacity-60">{subLabel}</span>
    </button>
  );
}

function ControlSection({ title, children }: any) {
  return (
    <div className="mb-8">
      <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ControlButton({ label, subLabel, active, isError }: any) {
  return (
    <button className={cn(
      "group flex w-full items-center justify-between rounded-xl p-4 transition-all active:scale-[0.98]",
      active ? "bg-primary/10 border border-primary/20 text-primary" : "bg-surface-container-low hover:bg-surface-container",
      isError && "border-l-4 border-error"
    )}>
      <div className="flex flex-col text-left">
        <span className={cn("text-[11px] font-bold", isError && "text-error")}>{label}</span>
        <span className={cn("mt-0.5 text-[9px] font-medium opacity-60", isError && "text-error/80")}>{subLabel}</span>
      </div>
      {active ? (
        <CheckCircle className="h-4 w-4" />
      ) : isError ? (
        <AlertTriangle className="h-4 w-4 text-error" />
      ) : (
        <ChevronRight className="h-4 w-4 text-on-surface-variant/40 group-hover:text-primary" />
      )}
    </button>
  );
}
