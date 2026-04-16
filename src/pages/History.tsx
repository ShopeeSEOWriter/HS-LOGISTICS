import { Link } from "react-router-dom";
import { PlusCircle, Truck, CheckCircle2, AlertTriangle, ChevronRight, FileText, ArrowLeft } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function History() {
  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-12">
      <Link 
        to="/" 
        className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-all hover:-translate-x-1"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Quay lại trang chủ</span>
        <span className="opacity-40">/ 返回首页</span>
      </Link>

      <div className="mb-16 flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <div>
          <h1 className="font-headline text-5xl font-black tracking-tighter text-on-surface">
            Lịch sử vận chuyển<br />
            <span className="text-2xl font-bold opacity-60">运输历史</span>
          </h1>
          <p className="mt-4 text-on-surface-variant">
            Quản lý và theo dõi tuyến hậu cần xuyên biên giới. / 管理并监控您的跨境物流渠道。
          </p>
        </div>
        <button className="signature-gradient flex items-center gap-3 rounded-xl px-8 py-5 font-bold text-on-primary shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">
          <PlusCircle className="h-5 w-5" />
          <div className="flex flex-col leading-tight">
            <span>Thêm theo dõi mới</span>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">添加新追踪</span>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="no-scrollbar mb-12 flex items-center gap-3 overflow-x-auto pb-2">
        <FilterButton label="Tất cả" subLabel="全部" active />
        <FilterButton label="Đang giao" subLabel="运输中" />
        <FilterButton label="Đã giao" subLabel="已送达" />
        <FilterButton label="Trễ hạn" subLabel="延误" />
      </div>

      {/* List */}
      <div className="space-y-8">
        <HistoryCard 
          id="PL-CNVN-8842"
          status="in-transit"
          lastUpdate="Dongxing Central Hub"
          updateTime="24 Th10, 2024 • 14:32"
          destination="Hanoi Hub"
          destDetail="North Vietnam Terminal"
          eta="27 Th10, 2024"
          color="bg-primary-container"
        />
        <HistoryCard 
          id="PL-CNVN-7719"
          status="delivered"
          lastUpdate="Người nhận đã ký"
          updateTime="21 Th10, 2024 • 09:15"
          destination="HCM District 1"
          destDetail="South Vietnam Logistics Hub"
          weight="142.5 kg"
        />
        <HistoryCard 
          id="PL-CNVN-9003"
          status="delayed"
          lastUpdate="Pingxiang Border"
          updateTime="Chờ thông quan / 等待清关"
          destination="Hanoi Hub"
          destDetail="Primary Sorting Center"
          eta="48 Giờ / 小时"
          color="bg-error"
        />
      </div>
    </main>
  );
}

function FilterButton({ label, subLabel, active }: any) {
  return (
    <button className={cn(
      "flex flex-col items-center rounded-full px-8 py-3 text-xs font-bold transition-all active:scale-95",
      active ? "bg-on-surface text-surface" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
    )}>
      <span>{label}</span>
      <span className="mt-0.5 text-[9px] opacity-60">{subLabel}</span>
    </button>
  );
}

function HistoryCard({ id, status, lastUpdate, updateTime, destination, destDetail, eta, weight, color }: any) {
  return (
    <div className="group relative flex flex-col gap-8 rounded-3xl bg-surface-container-lowest p-10 shadow-editorial transition-all hover:bg-surface-bright lg:flex-row lg:items-start">
      {color && <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", color)} />}
      
      <div className="flex-grow space-y-6">
        <div className="flex flex-wrap items-center gap-6">
          <span className={cn("font-headline text-4xl font-black tracking-tighter text-on-surface", status === "delivered" && "opacity-40")}>
            {id}
          </span>
          <StatusBadge status={status} />
        </div>

        <div className="grid grid-cols-2 gap-12 border-t border-surface-container pt-8 md:grid-cols-3">
          <HistoryStat 
            label={status === "delivered" ? "Trạng thái / 状态" : "Cập nhật cuối / 最后更新"}
            value={lastUpdate}
            subValue={updateTime}
            isError={status === "delayed"}
          />
          <HistoryStat 
            label="Điểm đến / 目的地"
            value={destination}
            subValue={destDetail}
          />
          <HistoryStat 
            label={weight ? "Trọng lượng / 总重量" : "Dự kiến / 预计到达"}
            value={weight || eta}
            isPrimary={!!eta && status !== "delayed"}
          />
        </div>
      </div>

      <div className="flex w-full shrink-0 items-center justify-center lg:w-48 lg:justify-end">
        <button className={cn(
          "flex w-full flex-col items-center rounded-xl py-4 font-bold transition-all active:scale-95 lg:w-auto lg:px-8",
          status === "delayed" ? "bg-error text-on-primary hover:bg-error/90" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
        )}>
          <span className="text-xs">{status === "delayed" ? "Kiểm tra xử lý" : status === "delivered" ? "Tải biên bản" : "Xem chi tiết"}</span>
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest opacity-70">
            {status === "delayed" ? "检查解决方案" : status === "delivered" ? "下载签收单" : "查看详情"}
          </span>
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    "in-transit": { icon: <Truck className="h-3 w-3" />, label: "Đang giao", cn: "运输中", color: "bg-secondary-container text-on-secondary-container" },
    "delivered": { icon: <CheckCircle2 className="h-3 w-3" />, label: "Đã giao", cn: "已送达", color: "bg-secondary-fixed text-on-secondary-fixed" },
    "delayed": { icon: <AlertTriangle className="h-3 w-3" />, label: "Trễ hạn", cn: "延误", color: "bg-error/10 text-error" }
  };
  const config = configs[status];

  return (
    <div className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest", config.color)}>
      {config.icon}
      <div className="flex flex-col leading-none">
        <span>{config.label}</span>
        <span className="text-[8px] opacity-70">{config.cn}</span>
      </div>
    </div>
  );
}

function HistoryStat({ label, value, subValue, isPrimary, isError }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{label}</p>
      <p className={cn("font-headline text-xl font-bold", isPrimary ? "text-primary" : "text-on-surface")}>{value}</p>
      {subValue && <p className={cn("text-xs font-medium", isError ? "text-error" : "text-on-surface-variant")}>{subValue}</p>}
    </div>
  );
}
