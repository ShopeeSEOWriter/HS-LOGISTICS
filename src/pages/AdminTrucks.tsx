import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, writeBatch, getDocs, where, setDoc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Truck, Package, ChevronRight, Clock, Plus, LayoutDashboard, Boxes, Scale, Headset, Trash2, X, MapPin } from "lucide-react";
import { cn } from "../lib/utils";
import ExcelUpload from "../components/ExcelUpload";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "../hooks/useAuth";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

import BulkUpdateModal from "../components/BulkUpdateModal";

import { getShippingSettings, updateShippingSettings, ShippingSettings } from "../services/settingsService";

export default function AdminTrucks() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [filteredTrucks, setFilteredTrucks] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("Tất cả");
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTruckCode, setNewTruckCode] = useState("");
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState<{ label: string, location: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ShippingSettings>({
    hanoi: { price_per_kg: 25000, price_per_m3: 3500000 },
    saigon: { price_per_kg: 30000, price_per_m3: 4500000 },
    min_weight: 1,
    volume_factor: 300
  });

  // Calculator state
  const [calc, setCalc] = useState({ l: 0, w: 0, h: 0, price: 0 });
  const calculatedVolume = (calc.l * calc.w * calc.h) / 1000000; // Assuming cm to m3
  const calculatedPrice = calculatedVolume * calc.price;

  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const fetchSettings = async () => {
      const s = await getShippingSettings();
      setSettings(s);
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateShippingSettings(settings);
      setShowSettings(false);
      alert("Đã cập nhật cài đặt vận chuyển!");
    } catch (error) {
      console.error(error);
      alert("Không thể cập nhật cài đặt.");
    }
  };

  const STATUS_FILTERS = [
    "Tất cả",
    "Đã nhận tại kho Trung Quốc",
    "Đã bốc hàng lên xe",
    "Đã xuất kho Trung Quốc",
    "Đang vận chuyển ra biên giới",
    "Đang làm thủ tục hải quan",
    "Đã thông quan",
    "Đã về đến Việt Nam",
    "Đã về kho Hà Nội",
    "Đang phân loại tại kho",
    "Đang giao hàng",
    "Đã giao hàng"
  ];

  const BULK_STATUS_OPTIONS = [
    { label: "Đã nhận tại kho Trung Quốc", subLabel: "已入中国仓", location: "Kho Trung Quốc", color: "bg-blue-400" },
    { label: "Đã bốc hàng lên xe", subLabel: "已装车", location: "Kho Trung Quốc", color: "bg-blue-500" },
    { label: "Đã xuất kho Trung Quốc", subLabel: "已从中国发货", location: "Kho Trung Quốc", color: "bg-blue-600" },
    { label: "Đang vận chuyển ra biên giới", subLabel: "前往边境中", location: "Trung Quốc", color: "bg-amber-400" },
    { label: "Đang làm thủ tục hải quan", subLabel: "海关清关中", location: "Biên giới", color: "bg-amber-500" },
    { label: "Đã thông quan", subLabel: "已完成清关", location: "Biên giới", color: "bg-emerald-400" },
    { label: "Đã về đến Việt Nam", subLabel: "已入越南境", location: "Việt Nam", color: "bg-emerald-500" },
    { label: "Đã về kho Hà Nội", subLabel: "已到河内仓", location: "Hà Nội", color: "bg-indigo-500" },
    { label: "Đang phân loại tại kho", subLabel: "仓库分拣中", location: "Hà Nội", color: "bg-indigo-600" },
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
      const batch = writeBatch(db);
      
      // 1. Delete the truck document
      batch.delete(doc(db, "trucks", truckId));
      
      // 2. Update all orders associated with this truck to have no truck_code
      if (truckId) {
        const ordersQuery = query(collection(db, "orders"), where("truck_code", "==", truckId));
        const ordersSnapshot = await getDocs(ordersQuery);
        ordersSnapshot.docs.forEach((orderDoc) => {
          batch.update(orderDoc.ref, { truck_code: null });
        });
      }

      await batch.commit();
    } catch (error) {
      console.error(error);
      alert("Không thể xóa xe. Vui lòng thử lại.");
    }
  };

  const handleCreateTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTruckCode.trim()) return;

    try {
      const truckRef = doc(db, "trucks", newTruckCode.trim());
      const truckSnap = await getDoc(truckRef);
      if (truckSnap.exists()) {
        alert("Mã xe này đã tồn tại!");
        return;
      }

      await setDoc(truckRef, {
        truck_code: newTruckCode.trim(),
        status: "Đã bốc hàng",
        last_updated: new Date().toISOString(),
        order_count: 0,
        destination: "Chưa xác định",
        created_at: new Date().toISOString()
      });

      setNewTruckCode("");
      setShowCreateModal(false);
    } catch (error) {
      console.error(error);
      alert("Không thể tạo xe. Vui lòng thử lại.");
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
          
          <div className="my-4 h-[1px] w-full bg-surface-container mx-4 opacity-50" />
          
          <Link to="/" className="ml-2 flex items-center gap-4 rounded-l-2xl px-6 py-4 text-on-surface-variant hover:bg-surface-container transition-all">
            <div className="text-primary"><ChevronRight className="h-5 w-5 rotate-180" /></div>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-none">Trang chủ</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-tighter opacity-60">返回首页</span>
            </div>
          </Link>
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
          
          <div className="flex gap-4">
            <button 
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 rounded-full bg-surface-container-high px-8 py-4 text-sm font-bold text-on-surface shadow-xl transition-all hover:opacity-90 active:scale-95"
            >
              Cài đặt cước phí
              <Scale className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-bold text-white shadow-xl transition-all hover:opacity-90 active:scale-95"
            >
              Tạo xe mới
              <Plus className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-2 rounded-full bg-on-background px-8 py-4 text-sm font-bold text-white shadow-xl transition-all hover:opacity-90 active:scale-95"
            >
              {showUpload ? "Đóng trình tải lên" : "Nhập dữ liệu Excel"}
              {showUpload ? <ChevronRight className="h-4 w-4 rotate-90" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-6 overflow-y-auto">
            <div className="w-full max-w-4xl rounded-3xl bg-surface-container-lowest p-10 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="font-headline text-2xl font-bold text-on-surface">Cài đặt cước phí vận chuyển</h3>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">Shipping Fee Configuration</p>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="rounded-full bg-surface-container-high p-2 text-on-surface-variant hover:bg-surface-container-highest"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Hanoi Table */}
                  <div className="space-y-6 rounded-2xl bg-surface-container-low p-6 border border-primary/10">
                    <div className="flex items-center gap-2 border-b border-surface-container pb-4">
                      <MapPin className="h-5 w-5 text-primary" />
                      <h4 className="font-bold">Bảng giá Hà Nội</h4>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Đơn giá mỗi kg (VND)</label>
                        <input 
                          type="number"
                          required
                          value={settings.hanoi.price_per_kg}
                          onChange={(e) => setSettings({...settings, hanoi: {...settings.hanoi, price_per_kg: parseInt(e.target.value)}})}
                          className="w-full rounded-xl border-none bg-surface-container-lowest p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Đơn giá mỗi m³ (VND)</label>
                        <input 
                          type="number"
                          required
                          value={settings.hanoi.price_per_m3}
                          onChange={(e) => setSettings({...settings, hanoi: {...settings.hanoi, price_per_m3: parseInt(e.target.value)}})}
                          className="w-full rounded-xl border-none bg-surface-container-lowest p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Saigon Table */}
                  <div className="space-y-6 rounded-2xl bg-surface-container-low p-6 border border-secondary/10">
                    <div className="flex items-center gap-2 border-b border-surface-container pb-4">
                      <MapPin className="h-5 w-5 text-secondary" />
                      <h4 className="font-bold">Bảng giá Sài Gòn</h4>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Đơn giá mỗi kg (VND)</label>
                        <input 
                          type="number"
                          required
                          value={settings.saigon.price_per_kg}
                          onChange={(e) => setSettings({...settings, saigon: {...settings.saigon, price_per_kg: parseInt(e.target.value)}})}
                          className="w-full rounded-xl border-none bg-surface-container-lowest p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Đơn giá mỗi m³ (VND)</label>
                        <input 
                          type="number"
                          required
                          value={settings.saigon.price_per_m3}
                          onChange={(e) => setSettings({...settings, saigon: {...settings.saigon, price_per_m3: parseInt(e.target.value)}})}
                          className="w-full rounded-xl border-none bg-surface-container-lowest p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* General Settings */}
                  <div className="space-y-6 rounded-2xl bg-surface-container-low p-6">
                    <h4 className="font-bold border-b border-surface-container pb-4">Cấu hình chung</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Min Weight (kg)</label>
                        <input 
                          type="number"
                          required
                          value={settings.min_weight}
                          onChange={(e) => setSettings({...settings, min_weight: parseFloat(e.target.value)})}
                          className="w-full rounded-xl border-none bg-surface-container-lowest p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Vol Factor (kg/m³)</label>
                        <input 
                          type="number"
                          required
                          value={settings.volume_factor}
                          onChange={(e) => setSettings({...settings, volume_factor: parseInt(e.target.value)})}
                          className="w-full rounded-xl border-none bg-surface-container-lowest p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Volume Calculator */}
                  <div className="space-y-6 rounded-2xl bg-surface-container-low p-6 border-2 border-dashed border-primary/20">
                    <div className="flex items-center justify-between border-b border-surface-container pb-4">
                      <h4 className="font-bold">Công cụ tính m³</h4>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
                        <Boxes className="h-3 w-3" />
                        CALCULATOR
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-on-surface-variant/60">Dài (cm)</label>
                        <input 
                          type="number"
                          value={calc.l}
                          onChange={(e) => setCalc({...calc, l: parseFloat(e.target.value)})}
                          className="w-full rounded-lg border-none bg-surface-container-lowest p-2 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-on-surface-variant/60">Rộng (cm)</label>
                        <input 
                          type="number"
                          value={calc.w}
                          onChange={(e) => setCalc({...calc, w: parseFloat(e.target.value)})}
                          className="w-full rounded-lg border-none bg-surface-container-lowest p-2 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-on-surface-variant/60">Cao (cm)</label>
                        <input 
                          type="number"
                          value={calc.h}
                          onChange={(e) => setCalc({...calc, h: parseFloat(e.target.value)})}
                          className="w-full rounded-lg border-none bg-surface-container-lowest p-2 text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase text-on-surface-variant/60">Đơn giá áp dụng (VND/m³)</label>
                      <input 
                        type="number"
                        value={calc.price}
                        onChange={(e) => setCalc({...calc, price: parseInt(e.target.value)})}
                        className="w-full rounded-lg border-none bg-surface-container-lowest p-2 text-xs font-bold"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-primary/5 p-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase text-primary/60">Kết quả</p>
                        <p className="text-sm font-black text-primary">{calculatedVolume.toFixed(4)} m³</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase text-primary/60">Thành tiền</p>
                        <p className="text-sm font-black text-primary">{new Intl.NumberFormat('vi-VN').format(calculatedPrice)} đ</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="flex-1 rounded-xl bg-surface-container-high py-4 text-sm font-bold text-on-surface transition-all hover:bg-surface-container-highest"
                  >
                    Hủy / 取消
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] signature-gradient rounded-xl py-4 text-sm font-bold text-on-primary shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Lưu cài đặt / 保存设置
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Truck Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-6">
            <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-10 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-8 flex items-center justify-between">
                <h3 className="font-headline text-2xl font-bold text-on-surface">Tạo xe vận chuyển mới</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full bg-surface-container-high p-2 text-on-surface-variant hover:bg-surface-container-highest"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTruck} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Mã xe / 车辆代码</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ví dụ: TRUCK-001, CONTAINER-A..."
                    value={newTruckCode}
                    onChange={(e) => setNewTruckCode(e.target.value)}
                    className="w-full rounded-xl border-none bg-surface-container-low p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full signature-gradient rounded-xl py-4 text-sm font-bold text-on-primary shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                >
                  Tạo xe / 创建
                </button>
              </form>
            </div>
          </div>
        )}

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
