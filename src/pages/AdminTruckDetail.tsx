import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, deleteDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Truck, Package, ChevronLeft, CheckCircle, Clock, AlertCircle, Loader2, MapPin, FileText, Trash2, Edit2 } from "lucide-react";
import { cn, mapDestination, safeFormatDate } from "../lib/utils";
import { format } from "date-fns";
import { useAuth } from "../hooks/useAuth";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

const STATUS_OPTIONS = [
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

import { getShippingSettings, updateShippingSettings, ShippingSettings, PRODUCT_CATEGORIES, RateEntry, calculateShippingFee } from "../services/settingsService";
import MessageModal from "../components/MessageModal";

export default function AdminTruckDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [truck, setTruck] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [messageModal, setMessageModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info"
  });
  
  // Edit Order State
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [isEditingTruck, setIsEditingTruck] = useState(false);
  const [truckForm, setTruckForm] = useState({
    destination: ""
  });
  const [editForm, setEditForm] = useState({
    destination: "",
    weight: "",
    volume: "",
    item_type: ""
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const s = await getShippingSettings();
      setSettings(s);
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!id || authLoading || !user) return;

    const truckRef = doc(db, "trucks", id);
    const unsubscribeTruck = onSnapshot(truckRef, (doc) => {
      if (doc.exists()) {
        setTruck({ id: doc.id, ...doc.data() });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `trucks/${id}`);
      setLoading(false);
    });

    if (id) {
      const ordersQuery = query(collection(db, "orders"), where("truck_code", "==", id));
      const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
        const orderList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(orderList);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "orders");
      });

      return () => {
        unsubscribeTruck();
        unsubscribeOrders();
      };
    }
  }, [id, user, authLoading]);

  const handleUpdateStatus = async (status: string, location: string) => {
    if (!id || isUpdating || !truck) return;

    // Validation: Cannot update empty truck
    if (orders.length === 0) {
      setMessageModal({
        isOpen: true,
        title: "Lỗi",
        message: "Không thể cập nhật trạng thái cho xe trống. Vui lòng thêm đơn hàng trước.",
        type: "error"
      });
      return;
    }

    // Validation: Cannot skip status steps (Optional, but requested)
    const currentIndex = STATUS_OPTIONS.findIndex(o => o.label === truck.status);
    const nextIndex = STATUS_OPTIONS.findIndex(o => o.label === status);
    
    if (nextIndex < currentIndex) {
      if (!window.confirm("Bạn đang cập nhật trạng thái lùi lại. Bạn có chắc chắn muốn thực hiện?")) {
        return;
      }
    } else if (nextIndex > currentIndex + 1) {
      if (!window.confirm(`Bạn đang bỏ qua các bước trung gian. Bạn có chắc chắn muốn cập nhật trực tiếp lên "${status}"?`)) {
        return;
      }
    }

    setIsUpdating(true);

    try {
      const batch = writeBatch(db);
      const truckRef = doc(db, "trucks", id);
      const now = new Date().toISOString();
      
      // 1. Update truck status
      batch.update(truckRef, {
        status,
        location,
        last_updated: serverTimestamp(),
      });

      // 2. Update all orders in this truck and add tracking logs
      for (const order of orders) {
        const orderRef = doc(db, "orders", order.id);
        const historyEntry = {
          status,
          location,
          timestamp: now,
          note: `Cập nhật trạng thái từ xe ${truck.truck_code}: ${status}`
        };

        // Update order with current status and append to history array
        batch.update(orderRef, {
          status,
          location,
          last_updated: serverTimestamp(),
          history: [...(order.history || []), historyEntry]
        });

        // Also keep the separate tracking_logs for backward compatibility/redundancy
        const logId = `log_${order.tracking_code}_${status.replace(/\s+/g, '_')}_${Date.now()}`;
        const logRef = doc(db, "tracking_logs", logId);
        batch.set(logRef, {
          tracking_code: order.tracking_code,
          status,
          timestamp: now,
          location,
          note: `Cập nhật trạng thái từ xe ${truck.truck_code}: ${status}`
        });
      }

      await batch.commit();
      setMessageModal({
        isOpen: true,
        title: "Thành công",
        message: `Đã cập nhật trạng thái "${status}" cho xe và ${orders.length} đơn hàng.`,
        type: "success"
      });
    } catch (err: any) {
      console.error("Update status error:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `trucks/${id}`);
      } catch (e: any) {
        setMessageModal({
          isOpen: true,
          title: "Lỗi",
          message: e.message,
          type: "error"
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveTruck = async () => {
    if (!id || isUpdating) return;
    setIsUpdating(true);
    try {
      const truckRef = doc(db, "trucks", id);
      await updateDoc(truckRef, {
        destination: mapDestination(truckForm.destination),
        last_updated: serverTimestamp()
      });
      setIsEditingTruck(false);
      setMessageModal({
        isOpen: true,
        title: "Thành công",
        message: "Đã cập nhật thông tin xe thành công.",
        type: "success"
      });
    } catch (err: any) {
      console.error("Save truck error:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `trucks/${id}`);
      } catch (e: any) {
        setMessageModal({
          isOpen: true,
          title: "Lỗi",
          message: e.message,
          type: "error"
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditModal = (order: any) => {
    setEditingOrder(order);
    setEditForm({
      destination: order.destination || "",
      weight: order.weight || "",
      volume: order.volume || "",
      item_type: order.item_type || ""
    });
  };

  const handleSaveOrder = async () => {
    if (!editingOrder || isUpdating || !settings) return;
    setIsUpdating(true);
    try {
      const weight = parseFloat(editForm.weight) || 0;
      const volume = parseFloat(editForm.volume) || 0;
      const destination = mapDestination(editForm.destination);
      
      const { totalCost, pricePerKg, pricePerM3 } = calculateShippingFee(weight, volume, editForm.item_type || PRODUCT_CATEGORIES[0].id, settings, destination);

      const orderRef = doc(db, "orders", editingOrder.id);
      await updateDoc(orderRef, {
        destination,
        weight,
        volume,
        item_type: editForm.item_type,
        price_per_kg: pricePerKg,
        price_per_m3: pricePerM3,
        total_cost: totalCost,
        last_updated: serverTimestamp(),
      });
      setEditingOrder(null);
      setMessageModal({
        isOpen: true,
        title: "Thành công",
        message: "Đã cập nhật thông tin đơn hàng thành công.",
        type: "success"
      });
    } catch (err: any) {
      console.error("Save order error:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${editingOrder.id}`);
      } catch (e: any) {
        setMessageModal({
          isOpen: true,
          title: "Lỗi",
          message: e.message,
          type: "error"
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteTruck = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa xe ${id}? Tất cả đơn hàng sẽ bị gỡ khỏi xe này.`)) return;

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "trucks", id!));

      if (id) {
        const ordersQuery = query(collection(db, "orders"), where("truck_code", "==", id));
        const ordersSnapshot = await getDocs(ordersQuery);
        ordersSnapshot.docs.forEach((orderDoc) => {
          batch.update(orderDoc.ref, { truck_code: null });
        });
      }

      await batch.commit();
      navigate("/admin/trucks");
    } catch (error) {
      console.error(error);
      setMessageModal({
        isOpen: true,
        title: "Lỗi",
        message: "Không thể xóa xe. Vui lòng thử lại.",
        type: "error"
      });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đơn hàng ${orderId}?`)) return;

    try {
      await deleteDoc(doc(db, "orders", orderId));
    } catch (error) {
      console.error(error);
      setMessageModal({
        isOpen: true,
        title: "Lỗi",
        message: "Không thể xóa đơn hàng. Vui lòng thử lại.",
        type: "error"
      });
    }
  };

  if (!truck) return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      <main className="flex-1 p-12 pt-24">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate("/admin/trucks")}
              className="flex items-center gap-2 text-sm font-bold text-on-surface-variant/60 hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Quay lại danh sách xe</span>
            </button>
            
            <div className="h-4 w-[1px] bg-surface-container" />
            
            <button 
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm font-bold text-on-surface-variant/60 hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Trang chủ theo dõi</span>
            </button>
          </div>

          <button 
            onClick={handleDeleteTruck}
            className="flex items-center gap-2 rounded-full bg-error/10 px-6 py-2 text-sm font-bold text-error transition-all hover:bg-error/20"
          >
            <Trash2 className="h-4 w-4" />
            Xóa xe / 删除车辆
          </button>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Left: Truck Info & Orders */}
          <div className="lg:col-span-8 space-y-12">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="font-headline text-4xl font-black tracking-tight">{truck.truck_code}</h1>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-widest opacity-40">Chi tiết xe vận chuyển / 车辆详情</p>
                      <span className="h-1 w-1 rounded-full bg-surface-container-highest" />
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-primary" />
                        <span className="text-xs font-bold text-primary">{mapDestination(truck.destination)}</span>
                        <button 
                          onClick={() => {
                            setTruckForm({ destination: truck.destination || "" });
                            setIsEditingTruck(true);
                          }}
                          className="ml-1 rounded-full p-1 hover:bg-primary/10 text-primary transition-colors"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Cập nhật cuối</div>
                <div className="mt-1 font-headline text-xl font-bold">{safeFormatDate(truck.last_updated)}</div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-editorial">
              <div className="border-b border-surface-container-low p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h2 className="font-headline text-xl font-bold">Danh sách đơn hàng ({orders.length})</h2>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Orders in this truck</div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low/50">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Mã vận đơn</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Thông tin</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Cước phí</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Trạng thái</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container/30">
                    {orders.map((order) => (
                      <tr key={order.id} className="transition-colors hover:bg-surface-bright">
                        <td className="px-8 py-6">
                          <div className="font-bold text-primary">{order.tracking_code}</div>
                          <div className="text-[10px] font-medium text-on-surface-variant/60">
                            {PRODUCT_CATEGORIES.find(c => c.id === order.item_type)?.label || order.item_type}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-xs font-bold">{order.destination}</div>
                          <div className="text-[10px] text-on-surface-variant/60">{order.weight}kg | {order.volume}m³</div>
                        </td>
                        <td className="px-8 py-6">
                          {order.total_cost ? (
                            <>
                              <div className="text-xs font-bold text-on-surface">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.total_cost)}</div>
                              <div className="text-[10px] text-on-surface-variant/60">
                                {new Intl.NumberFormat('vi-VN').format(order.price_per_kg)}/kg
                                {order.price_per_m3 && ` | ${new Intl.NumberFormat('vi-VN').format(order.price_per_m3)}/m³`}
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px] italic text-on-surface-variant/40">Chưa tính phí</div>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <div className="inline-flex rounded-full bg-primary/10 px-4 py-1 text-[10px] font-bold text-primary">
                            {order.status}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openEditModal(order)}
                              className="rounded-lg bg-surface-container-high px-3 py-1.5 text-[10px] font-bold text-on-surface transition-colors hover:bg-primary hover:text-white"
                              title="Sửa đơn hàng"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button 
                              onClick={() => handleDeleteOrder(order.id)}
                              className="rounded-lg bg-error/10 px-3 py-1.5 text-[10px] font-bold text-error transition-colors hover:bg-error hover:text-white"
                              title="Xóa đơn hàng"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Status Controls */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-8">
              <div className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-editorial">
                <div className="signature-gradient p-8 text-on-primary">
                  <h3 className="font-headline text-2xl font-bold">Cập nhật trạng thái</h3>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-80">Update status for all orders</p>
                </div>
                
                <div className="p-8 space-y-3">
                  {STATUS_OPTIONS.map((option) => {
                    const isActive = truck.status === option.label;
                    return (
                      <button
                        key={option.label}
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(option.label, option.location)}
                        className={cn(
                          "group relative flex w-full flex-col items-start rounded-2xl p-5 transition-all active:scale-[0.98]",
                          isActive 
                            ? "bg-on-background text-white shadow-xl" 
                            : "bg-surface-container-low hover:bg-surface-container",
                          isUpdating && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-bold">{option.label}</span>
                            <span className={cn("mt-0.5 text-[10px] font-medium opacity-60", isActive && "opacity-80")}>{option.subLabel}</span>
                          </div>
                          {isActive && <CheckCircle className="h-5 w-5" />}
                        </div>
                        
                        <div className="mt-4 flex items-center gap-2">
                          <MapPin className={cn("h-3 w-3", isActive ? "text-white" : "text-primary")} />
                          <span className={cn("text-[9px] font-bold uppercase tracking-widest", isActive ? "text-white/80" : "text-on-surface-variant/60")}>
                            {option.location}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-surface-container-lowest p-8 shadow-editorial">
                <div className="flex items-center gap-3 mb-6">
                  <Clock className="h-5 w-5 text-primary" />
                  <h4 className="font-headline text-lg font-bold">Lịch trình xe</h4>
                </div>
                <div className="space-y-6">
                  {STATUS_OPTIONS.map((option, index) => {
                    const currentIndex = STATUS_OPTIONS.findIndex(o => o.label === truck.status);
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    
                    return (
                      <div key={option.label} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "h-4 w-4 rounded-full border-2",
                            isCompleted ? "bg-green-500 border-green-500" : isCurrent ? "bg-blue-500 border-blue-500" : "bg-transparent border-surface-container-high"
                          )} />
                          {index !== STATUS_OPTIONS.length - 1 && (
                            <div className={cn(
                              "w-0.5 flex-1",
                              isCompleted ? "bg-green-500" : "bg-surface-container-high"
                            )} />
                          )}
                        </div>
                        <div className="pb-6">
                          <div className={cn("text-xs font-bold", isCurrent ? "text-blue-500" : isCompleted ? "text-green-500" : "text-on-surface-variant/40")}>
                            {option.label}
                          </div>
                          <div className="text-[9px] font-bold uppercase tracking-widest opacity-40">{option.location}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Truck Modal */}
      {isEditingTruck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-6">
          <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-10 shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="font-headline text-2xl font-bold text-on-surface">Sửa thông tin xe</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{truck.truck_code}</p>
              </div>
              <button 
                onClick={() => setIsEditingTruck(false)}
                className="rounded-full bg-surface-container-high p-2 text-on-surface-variant hover:bg-surface-container-highest"
              >
                <ChevronLeft className="h-5 w-5 rotate-180" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Nơi đến / 目的地</label>
                <input 
                  type="text"
                  value={truckForm.destination}
                  onChange={(e) => setTruckForm({...truckForm, destination: e.target.value})}
                  className="w-full rounded-xl border-none bg-surface-container-low p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                  placeholder="Ví dụ: HN, SG, Hà Nội..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsEditingTruck(false)}
                  className="flex-1 rounded-xl bg-surface-container-high py-4 text-sm font-bold text-on-surface transition-all hover:bg-surface-container-highest"
                >
                  Hủy / 取消
                </button>
                <button 
                  onClick={handleSaveTruck}
                  disabled={isUpdating}
                  className="flex-1 signature-gradient rounded-xl py-4 text-sm font-bold text-on-primary shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {isUpdating ? "Đang lưu..." : "Lưu thay đổi / 保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-6">
          <div className="w-full max-w-lg rounded-3xl bg-surface-container-lowest p-10 shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="font-headline text-2xl font-bold text-on-surface">Sửa đơn hàng</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{editingOrder.tracking_code}</p>
              </div>
              <button 
                onClick={() => setEditingOrder(null)}
                className="rounded-full bg-surface-container-high p-2 text-on-surface-variant hover:bg-surface-container-highest"
              >
                <ChevronLeft className="h-5 w-5 rotate-180" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Điểm đến / 目的地</label>
                <input 
                  type="text"
                  value={editForm.destination}
                  onChange={(e) => setEditForm({...editForm, destination: e.target.value})}
                  className="w-full rounded-xl border-none bg-surface-container-low p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Trọng lượng (kg)</label>
                  <input 
                    type="text"
                    value={editForm.weight}
                    onChange={(e) => setEditForm({...editForm, weight: e.target.value})}
                    className="w-full rounded-xl border-none bg-surface-container-low p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Thể tích (m³)</label>
                  <input 
                    type="text"
                    value={editForm.volume}
                    onChange={(e) => setEditForm({...editForm, volume: e.target.value})}
                    className="w-full rounded-xl border-none bg-surface-container-low p-4 text-sm font-medium focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Mặt hàng / 货物类型</label>
                <select 
                  value={editForm.item_type}
                  onChange={(e) => setEditForm({...editForm, item_type: e.target.value})}
                  className="w-full rounded-xl border-none bg-surface-container-low p-4 text-sm font-bold focus:ring-2 focus:ring-primary appearance-none"
                >
                  <option value="">Chọn loại hàng</option>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 rounded-xl bg-surface-container-high py-4 text-sm font-bold text-on-surface transition-all hover:bg-surface-container-highest"
                >
                  Hủy / 取消
                </button>
                <button 
                  onClick={handleSaveOrder}
                  disabled={isUpdating}
                  className="flex-1 signature-gradient rounded-xl py-4 text-sm font-bold text-on-primary shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {isUpdating ? "Đang lưu..." : "Lưu thay đổi / 保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <MessageModal 
        isOpen={messageModal.isOpen}
        onClose={() => setMessageModal({ ...messageModal, isOpen: false })}
        title={messageModal.title}
        message={messageModal.message}
        type={messageModal.type}
      />
    </div>
  );
}
