import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Truck, Package, ChevronRight, Clock, Plus, LayoutDashboard, Boxes, Scale, Headset, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import ExcelUpload from "../components/ExcelUpload";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "../hooks/useAuth";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

import BulkUpdateModal from "../components/BulkUpdateModal";

export default function AdminTrucks() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [filteredTrucks, setFilteredTrucks] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("Tất cả");
  const [showUpload, setShowUpload] = useState(false);
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState<{ label: string, location: string } | null>(null);

  const { user, loading: authLoading } = useAuth();

  const STATUS_FILTERS = [
    "Tất cả",
    "Đã bốc hàng",
    "Đang làm thủ tục hải quan",
    "Xe đã qua Việt Nam",
    "Xe đang về kho Hà Nội",
    "Đã về kho Hà Nội",
    "Đang giao hàng",
    "Đã giao hàng"
  ];

  const BULK_STATUS_OPTIONS = [
    { label: "Đã bốc hàng", subLabel: "已装车", location: "Đông Hưng", color: "bg-blue-500" },
    { label: "Đang làm thủ tục hải quan", subLabel: "海关清关中", location: "Biên giới", color: "bg-amber-500" },
    { label: "Xe đã qua Việt Nam", subLabel: "车辆已入越南", location: "Móng Cái", color: "bg-emerald-500" },
    { label: "Xe đang về kho Hà Nội", subLabel: "车辆前往河内仓", location: "Trên đường", color: "bg-indigo-500" },
    { label: "Đã về kho Hà Nội", subLabel: "已到河内仓库", location: "Hà Nội", color: "bg-indigo-600" },
    { label: "Đang giao hàng", subLabel: "派送中", location: "Nội địa VN", color: "bg-purple-500" },
    { label: "Đã giao hàng", subLabel: "已送达", location: "Người nhận", color: "bg-green-500" },
  ];

  useEffect(() => {
    if (authLoading || !user) return;

    const q = query(collection(db, "trucks"), orderBy("last_updated", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const truckList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrucks(truckList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "trucks");
    });
    return () => unsubscribe();
  }, [user, authLoading]);

  useEffect(() => {
    if (selectedStatus === "Tất cả") {
      setFilteredTrucks(trucks);
    } else {
      setFilteredTrucks(trucks.filter(t => t.status === selectedStatus));
    }
  }, [trucks, selectedStatus]);

  const handleDeleteTruck = async (e: React.MouseEvent, truckId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn xóa xe ${truckId}? Tất cả đơn hàng sẽ bị gỡ khỏi xe này.`)) return;

    try {
      const response = await fetch(`/api/admin/trucks/${truckId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Lỗi khi xóa xe");
    } catch (error) {
      console.error(error);
      alert("Không thể xóa xe. Vui lòng thử lại.");
    }
  };

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
          <SidebarLink icon={<LayoutDashboard className="h-5 w-5" />} label="Bảng điều khiển" subLabel="仪表盘" />
          <SidebarLink icon={<Truck className="h-5 w-5" />} label="Quản lý xe" subLabel="车辆管理" active />
          <SidebarLink icon={<Boxes className="h-5 w-5" />} label="Kho hàng" subLabel="库存" />
          <SidebarLink icon={<Scale className="h-5 w-5" />} label="Hải quan" subLabel="海关" />
          <SidebarLink icon={<Headset className="h-5 w-5" />} label="Hỗ trợ" subLabel="支持" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 p-12 pt-24">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-4xl font-black tracking-tight">Quản lý xe vận chuyển</h1>
              <span className="text-sm font-bold text-on-surface-variant/50">/ 车辆管理</span>
            </div>
            <p className="mt-2 text-sm font-medium text-on-surface-variant/60">
              Quản lý danh sách xe, container và cập nhật trạng thái hàng loạt.
            </p>
          </div>
          
          <button 
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 rounded-full bg-on-background px-8 py-4 text-sm font-bold text-white shadow-xl transition-all hover:opacity-90 active:scale-95"
          >
            {showUpload ? "Đóng trình tải lên" : "Nhập dữ liệu Excel"}
            {showUpload ? <ChevronRight className="h-4 w-4 rotate-90" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>

        {/* Status Filter Bar */}
        <div className="mb-12 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={cn(
                "rounded-xl px-6 py-2 text-xs font-bold transition-all border-2",
                selectedStatus === status 
                  ? "bg-primary text-white border-primary shadow-lg" 
                  : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/30 hover:bg-surface-container"
              )}
            >
              {status}
            </button>
          ))}
        </div>

        {showUpload && (
          <div className="mb-16 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="rounded-3xl bg-surface-container-lowest p-12 shadow-editorial">
              <div className="mb-8 text-center">
                <h2 className="font-headline text-2xl font-black">Nhập chuyến hàng mới</h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest opacity-40">Tải lên tệp Excel để tạo hoặc cập nhật xe và đơn hàng</p>
              </div>
              <ExcelUpload onSuccess={() => setShowUpload(false)} />
            </div>
          </div>
        )}

        {/* Bulk Update Section */}
        <div className="mb-16 rounded-[2.5rem] bg-surface-container-lowest p-12 shadow-editorial border-2 border-primary/10">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="font-headline text-3xl font-black text-on-surface">Cập nhật hàng loạt theo trạng thái</h2>
              <p className="mt-2 text-sm font-medium text-on-surface-variant/60">Chọn một trạng thái bên dưới, sau đó tải lên file Excel chứa danh sách mã vận đơn.</p>
            </div>
            <div className="text-right">
              <span className="rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">Tính năng nâng cao</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            {BULK_STATUS_OPTIONS.map((option) => (
              <button
                key={option.label}
                onClick={() => setBulkUpdateStatus(option)}
                className="group flex flex-col items-center justify-center rounded-xl bg-surface-container-low p-6 border-2 border-primary transition-all hover:bg-on-background hover:text-white hover:shadow-xl active:scale-95"
              >
                <div className={cn("mb-4 h-3 w-3 rounded-full", option.color)} />
                <span className="text-center text-[11px] font-bold leading-tight">{option.label}</span>
                <span className="mt-1 text-center text-[9px] font-medium opacity-50">{option.subLabel}</span>
                <span className="mt-2 text-[9px] font-bold uppercase tracking-widest opacity-40 group-hover:opacity-80">{option.location}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTrucks.map((truck) => (
            <Link 
              key={truck.id} 
              to={`/admin/trucks/${truck.id}`}
              className="group relative flex flex-col overflow-hidden rounded-3xl bg-surface-container-lowest p-8 shadow-editorial transition-all hover:bg-surface-bright hover:shadow-2xl"
            >
              <div className="mb-6 flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container shadow-inner group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Truck className="h-7 w-7" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={cn(
                    "rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-widest",
                    truck.status === "Đã giao hàng" ? "bg-secondary-container text-on-secondary-container" : "bg-primary/10 text-primary"
                  )}>
                    {truck.status}
                  </div>
                  <button 
                    onClick={(e) => handleDeleteTruck(e, truck.id)}
                    className="rounded-full p-2 text-on-surface-variant/40 hover:bg-error/10 hover:text-error transition-all"
                    title="Xóa xe"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-headline text-2xl font-black text-on-surface">{truck.truck_code}</h3>
              
              <div className="mt-6 flex items-center gap-6">
                <div className="flex items-center gap-2 text-on-surface-variant/60">
                  <Package className="h-4 w-4" />
                  <span className="text-xs font-bold">{truck.order_count} đơn hàng</span>
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant/60">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-bold">
                    {format(new Date(truck.last_updated), "dd/MM HH:mm")}
                  </span>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-2 text-xs font-bold text-primary opacity-0 transition-all group-hover:opacity-100">
                <span>Chi tiết xe</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </main>
      
      {bulkUpdateStatus && (
        <BulkUpdateModal 
          status={bulkUpdateStatus.label}
          location={bulkUpdateStatus.location}
          onClose={() => setBulkUpdateStatus(null)}
          onSuccess={(count) => {
            setBulkUpdateStatus(null);
            alert(`Đã cập nhật thành công ${count} mã vận đơn!`);
          }}
        />
      )}
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
