import React, { useState, useEffect } from "react";
import { Package, Truck, MapPin, CheckCircle2, Clock, Info, Headset, Route, AlertCircle, RefreshCw, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { cn } from "@/src/lib/utils";
import { format } from "date-fns";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

const STATUS_STEPS = [
  "Đã bốc hàng",
  "Đang làm thủ tục hải quan",
  "Xe đã qua Việt Nam",
  "Xe đang về kho Hà Nội",
  "Đã về kho Hà Nội",
  "Đang giao hàng",
  "Đã giao hàng"
];

const STATUS_CHINESE: Record<string, string> = {
  "Đã bốc hàng": "已装车",
  "Đang làm thủ tục hải quan": "海关清关中",
  "Xe đã qua Việt Nam": "车辆已入越南",
  "Xe đang về kho Hà Nội": "车辆前往河内仓",
  "Đã về kho Hà Nội": "已到河内仓库",
  "Đang giao hàng": "派送中",
  "Đã giao hàng": "已送达"
};

export default function TrackingDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [truckOrders, setTruckOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setOrder(null);
    setLogs([]);
    setTruckOrders([]);

    // We'll use a single effect to handle both order and truck lookup
    // This avoids nested listeners and race conditions
    
    const orderRef = doc(db, "orders", id);
    const truckRef = doc(db, "trucks", id);

    let unsubOrder = () => {};
    let unsubTruck = () => {};
    let unsubTruckOrders = () => {};

    unsubOrder = onSnapshot(orderRef, (docSnap) => {
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data(), type: "order" });
        setLoading(false);
      } else {
        // If not an order, try to find as a truck
        unsubTruck = onSnapshot(truckRef, (truckSnap) => {
          if (truckSnap.exists()) {
            const truckData = truckSnap.data();
            setOrder({ 
              id: truckSnap.id, 
              tracking_code: truckSnap.id,
              status: truckData.status,
              last_updated: truckData.last_updated,
              type: "truck",
              order_count: truckData.order_count,
              destination: truckData.destination
            });

            // If it's a truck, fetch the orders inside it
            const q = query(collection(db, "orders"), where("truck_code", "==", id));
            unsubTruckOrders = onSnapshot(q, (snapshot) => {
              const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
              setTruckOrders(list);
            }, (err) => handleFirestoreError(err, OperationType.LIST, "orders"));

          } else {
            setOrder(null);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `trucks/${id}`);
          setLoading(false);
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `orders/${id}`);
      setLoading(false);
    });

    // Tracking logs for this ID (could be order code or truck code)
    const logsQuery = query(
      collection(db, "tracking_logs"),
      where("tracking_code", "==", id),
      orderBy("timestamp", "asc")
    );
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Filter duplicates by status, keeping only the latest one per status
      const statusMap = new Map();
      logList.forEach(log => {
        statusMap.set(log.status, log);
      });
      
      const uniqueLogs = Array.from(statusMap.values()).sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      setLogs(uniqueLogs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "tracking_logs");
    });

    return () => {
      unsubOrder();
      unsubTruck();
      unsubTruckOrders();
      unsubscribeLogs();
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <RefreshCw className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center px-8 py-32 text-center">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-error/10 text-error">
          <AlertCircle className="h-12 w-12" />
        </div>
        <h1 className="font-headline text-4xl font-black">Không tìm thấy vận đơn</h1>
        <p className="mt-4 text-on-surface-variant">Mã vận đơn {id} không tồn tại trong hệ thống của chúng tôi.</p>
        <Link to="/" className="mt-12 rounded-full bg-on-background px-8 py-4 text-sm font-bold text-white shadow-xl">
          Quay lại trang chủ
        </Link>
      </main>
    );
  }

  return (
    <main className="relative mx-auto w-full max-w-7xl px-8 py-12">
      {/* Background Decorative Grids */}
      <div className="grid-pattern pointer-events-none absolute left-0 top-0 h-full w-full opacity-[0.03]" />
      <div className="grid-pattern pointer-events-none absolute -right-20 top-40 h-64 w-64 opacity-20" />
      <div className="grid-pattern pointer-events-none absolute -left-20 bottom-40 h-80 w-80 opacity-20" />

      {/* Hero Tracking Summary */}
      <div className="relative z-10 mb-16">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Trạng thái vận chuyển / 物流状态</span>
            <h1 className="font-headline text-5xl font-black tracking-tighter text-on-surface md:text-7xl">
              {order.tracking_code}
            </h1>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex items-center gap-3 rounded-full bg-secondary-container px-5 py-2 text-sm font-bold text-on-secondary-container shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
              </span>
              {order.status}
            </div>
            <p className="text-sm font-medium text-on-surface-variant">
              Cập nhật lúc: {format(new Date(order.last_updated), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
        </div>
      </div>

      {/* Bento Stats */}
      <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="col-span-3 rounded-2xl border-l-4 border-primary-container bg-surface-container-lowest p-10 shadow-editorial">
          <div className="grid grid-cols-2 gap-12 md:grid-cols-4">
            {order.type === "order" ? (
              <>
                <Stat label="Trọng lượng / 重量" value={order.weight || "N/A"} unit="kg" />
                <Stat label="Thể tích / 体积" value={order.volume || "N/A"} unit="M3" />
                <Stat label="Nơi đến / 目的地" value={order.destination || "N/A"} />
                <Stat label="Mặt hàng / 货物类型" value={order.item_type || "Hàng hóa"} icon={<Package className="h-4 w-4" />} />
              </>
            ) : (
              <>
                <Stat label="Mã xe / 车号" value={order.id} />
                <Stat label="Số kiện / 包裹数" value={order.order_count || "0"} />
                <Stat label="Nơi đến / 目的地" value={order.destination || "Chưa xác định"} />
                <Stat label="Phương thức / 运输方式" value="Bộ / 陆运" icon={<Truck className="h-4 w-4" />} />
              </>
            )}
          </div>
        </div>
        <div className="signature-gradient flex flex-col justify-between rounded-2xl p-10 text-on-primary shadow-lg">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
              {order.type === "order" ? "Mã xe vận chuyển / 车号" : "Trạng thái xe / 车辆状态"}
            </p>
            <p className="font-headline text-2xl font-black leading-tight">
              {order.type === "order" ? order.truck_code : order.status}
            </p>
          </div>
          <Link 
            to="/support"
            className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-white/20 py-4 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <Headset className="h-4 w-4" />
            Hỗ trợ / 咨询客服
          </Link>
        </div>
      </div>

      {/* Route & Timeline */}
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
        {/* Timeline */}
        <div className="lg:col-span-5">
          <div className="mb-12 flex items-center gap-3">
            <Route className="h-6 w-6 text-primary" />
            <h2 className="font-headline text-2xl font-black">Hành trình vận đơn / 运单行程</h2>
          </div>
          
          <div className="relative space-y-10">
            <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-surface-container" />
            
            {logs.map((log, index) => (
              <TimelineItem 
                key={log.id}
                status={index === logs.length - 1 ? "active" : "completed"}
                title={log.status}
                subLabel={STATUS_CHINESE[log.status]}
                time={format(new Date(log.timestamp), "dd/MM/yyyy HH:mm")}
                description={log.note}
                tag={log.location}
              />
            ))}
            
            {logs.length === 0 && (
              <p className="text-sm font-medium text-on-surface-variant/60 italic">Chưa có dữ liệu hành trình.</p>
            )}
          </div>
        </div>

        {/* Map & Manifest */}
        <div className="space-y-8 lg:col-span-7">
          <div className="group relative aspect-[16/10] overflow-hidden rounded-3xl bg-surface-container shadow-inner">
            <img 
              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1200" 
              alt="Map"
              className="h-full w-full object-cover opacity-40 grayscale transition-opacity duration-700 group-hover:opacity-60"
            />
            
            <div className="absolute top-8 left-8 right-8 flex justify-between">
              <HubBadge label="Nguồn / 始发地" city="Đông Hưng / 东兴" />
              <HubBadge 
                label="Đến / 目的地" 
                city={
                  order.destination === "Hà Nội" ? "Hà Nội / 河内" :
                  order.destination === "Hồ Chí Minh" ? "Hồ Chí Minh / 胡志明" :
                  order.destination === "Hải Phòng" ? "Hải Phòng / 海防" :
                  order.destination === "Đà Nẵng" ? "Đà Nẵng / 岘港" :
                  (order.destination || "Hà Nội / 河内")
                } 
              />
            </div>

            <div className="glass-panel absolute bottom-8 left-8 right-8 rounded-2xl p-6 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-primary">Tiến độ vận chuyển / 运输进度</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Chặng / 运输阶段</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                <div 
                  className="signature-gradient h-full rounded-full transition-all duration-1000" 
                  style={{ 
                    width: (() => {
                      const index = STATUS_STEPS.indexOf(order.status);
                      if (index === -1) return "10%";
                      return `${((index + 1) / STATUS_STEPS.length) * 100}%`;
                    })()
                  }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-surface-container-low p-10">
            <h3 className="mb-8 font-headline text-xl font-bold">
              {order.type === "truck" ? "Danh sách mã hàng / 运单列表" : "Thông tin bổ sung / 运单详细信息"}
            </h3>
            
            {order.type === "truck" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {truckOrders.map((o) => (
                    <Link 
                      key={o.id} 
                      to={`/tracking/${o.tracking_code}`}
                      className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4 transition-all hover:bg-primary/5 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold">{o.tracking_code}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-on-surface-variant/40" />
                    </Link>
                  ))}
                  {truckOrders.length === 0 && (
                    <p className="col-span-2 text-center text-xs font-medium text-on-surface-variant/60 italic">
                      Chưa có mã hàng trong xe này.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                <ManifestItem label="Mã vận đơn / 运单号" value={order.tracking_code} />
                <ManifestItem label="Mã xe / 车号" value={order.truck_code} />
                <ManifestItem label="Nơi đến / 目的地" value={order.destination} />
                <ManifestItem label="Loại hàng / 货物类型" value={order.item_type} />
                <ManifestItem 
                  label="Lưu ý xử lý / 装卸说明" 
                  value="Hàng vận chuyển xuyên biên giới" 
                  icon={<Info className="h-3 w-3 text-primary" />}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, unit, icon }: any) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant leading-tight">{label}</p>
      <div className="flex items-center gap-2">
        {icon && <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-highest">{icon}</div>}
        <p className="font-headline text-2xl font-bold">
          {value} {unit && <span className="text-xs font-medium opacity-60">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

function TimelineItem({ status, title, subLabel, time, description, tag }: any) {
  const displayTag = tag === "Lạng Sơn" ? "Móng Cái" : tag;
  return (
    <div className="relative flex gap-6">
      <div className={cn(
        "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-4 border-surface",
        status === "completed" && "bg-secondary-container text-on-secondary-container",
        status === "active" && "bg-primary text-white shadow-[0_0_15px_rgba(255,69,0,0.3)]",
        status === "pending" && "bg-surface-container"
      )}>
        {status === "completed" && <CheckCircle2 className="h-3 w-3" />}
        {status === "active" && <RefreshCw className="h-3 w-3 animate-spin-slow" />}
      </div>
      
      <div className={cn(
        "flex-grow rounded-2xl p-4 transition-all",
        status === "active" && "bg-surface-container-low border-l-2 border-primary"
      )}>
        <div className="flex items-center gap-2">
          <div>
            <p className={cn("text-sm font-bold", status === "active" ? "text-primary" : "text-on-surface")}>{title}</p>
            {subLabel && <p className="text-[10px] font-medium opacity-50">{subLabel}</p>}
          </div>
          {displayTag && <span className="rounded bg-surface-container-high px-2 py-0.5 text-[9px] font-bold uppercase">{displayTag}</span>}
        </div>
        {time && <p className="mt-1 text-xs text-on-surface-variant">{time}</p>}
        {description && <p className="mt-1 text-xs font-medium text-on-surface-variant">{description}</p>}
      </div>
    </div>
  );
}

function HubBadge({ label, city }: any) {
  return (
    <div className="glass-panel rounded-xl border border-white/40 p-4 shadow-xl">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className="font-headline text-lg font-black text-on-surface">{city}</p>
    </div>
  );
}

function ManifestItem({ label, value, icon, isError }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
      <div className="flex items-center gap-1">
        {icon}
        <p className={cn("text-sm font-medium", isError && "text-error")}>{value}</p>
      </div>
    </div>
  );
}
