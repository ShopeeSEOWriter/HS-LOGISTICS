import React, { useState, useEffect, useRef } from "react";
import { 
  collection, query, getDocs, doc, updateDoc, addDoc, 
  serverTimestamp, where, writeBatch, getDoc, setDoc,
  onSnapshot, orderBy 
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/errorHandler";
import * as XLSX from "xlsx";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, Package, Truck, MapPin, Search, Filter, 
  Upload, CheckCircle2, AlertCircle, LogOut, ChevronRight, 
  MoreHorizontal, Plus, Download, FileSpreadsheet, RefreshCw,
  Eye, TrendingUp, BarChart3, PieChart as PieChartIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, mapDestination, safeFormatDate } from "../lib/utils";
import AdminSettings from "../components/AdminSettings";
import AdminSidebar from "../components/AdminSidebar";
import BulkUpdateModal from "../components/BulkUpdateModal";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, Legend 
} from 'recharts';
import { Settings } from "lucide-react";

const STEPS = [
  "Order created",
  "Received at China warehouse",
  "Packed into truck/container",
  "Departed China",
  "Đang vận chuyển ra biên giới",
  "Đang làm thủ tục hải quan",
  "Đang kiểm hoá tại cửa khẩu",
  "Customs clearance",
  "Arrived Vietnam",
  "Đang vận chuyển về Hà Nội",
  "Arrived Hanoi warehouse",
  "Out for delivery",
  "Delivered"
];

const STATUS_COLORS: Record<string, string> = {
  "Order created": "#94a3b8",
  "Received at China warehouse": "#fbbf24",
  "Packed into truck/container": "#f59e0b",
  "Departed China": "#ea580c",
  "Đang vận chuyển ra biên giới": "#fcd34d",
  "Đang làm thủ tục hải quan": "#f59e0b",
  "Đang kiểm hoá tại cửa khẩu": "#ef4444",
  "Customs inspection": "#f59e0b",
  "Customs examination": "#ef4444",
  "Customs clearance": "#6366f1",
  "Arrived Vietnam": "#10b981",
  "Đang vận chuyển về Hà Nội": "#34d399",
  "Arrived Hanoi warehouse": "#059669",
  "Out for delivery": "#8b5cf6",
  "Delivered": "#22c55e"
};

const STATUS_CN: Record<string, string> = {
  "Order created": "订单已创建",
  "Received at China warehouse": "已入中国仓",
  "Packed into truck/container": "已装车",
  "Departed China": "已从中国发货",
  "Đang vận chuyển ra biên giới": "前往边境中",
  "Đang làm thủ tục hải quan": "海关清关中",
  "Đang kiểm hoá tại cửa khẩu": "海关查验中",
  "Customs inspection": "海关清关中",
  "Customs examination": "海关查验中",
  "Customs clearance": "已完成清关",
  "Arrived Vietnam": "已入越南境",
  "Đang vận chuyển về Hà Nội": "前往河内中",
  "Arrived Hanoi warehouse": "已到河内仓",
  "Out for delivery": "派送中",
  "Delivered": "已送达"
};

const TRUCK_ACTIONS = [
  { label: "Đã bốc hàng lên xe", subLabel: "已装车", status: "Packed into truck/container", location: "China Warehouse" },
  { label: "Đang làm thủ tục hải quan", subLabel: "海关清关中", status: "Customs clearance", location: "Border Gate" },
  { label: "Đã sang Việt Nam", subLabel: "已入越南境", status: "Arrived Vietnam", location: "Vietnam Border" },
  { label: "Đang vận chuyển về Hà Nội", subLabel: "前往河内中", status: "Đang vận chuyển về Hà Nội", location: "Việt Nam" },
  { label: "Đã về kho Hà Nội", subLabel: "已到河内仓", status: "Arrived Hanoi warehouse", location: "Hanoi Warehouse" },
  { label: "Đang giao hàng", subLabel: "派送中", status: "Out for delivery", location: "On Delivery Vehicle" },
  { label: "Đã giao hàng", subLabel: "已送达", status: "Delivered", location: "Customer Address" }
];

export default function AdminDashboard({ initialTab = "overview" }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [orders, setOrders] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [trackingSearchTerm, setTrackingSearchTerm] = useState("");
  const [searchedOrder, setSearchedOrder] = useState<any | null>(null);
  const [isSearchingTracking, setIsSearchingTracking] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [uploading, setUploading] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const qOrders = query(collection(db, "orders"));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qTrucks = query(collection(db, "trucks"), orderBy("updated_at", "desc"));
    const unsubscribeTrucks = onSnapshot(qTrucks, (snapshot) => {
      setTrucks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeTrucks();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const ordersSnapshot = await getDocs(collection(db, "orders"));
      const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);

      const trucksSnapshot = await getDocs(query(collection(db, "trucks"), orderBy("updated_at", "desc")));
      setTrucks(trucksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Chart Data Preparation
  const getOrdersPerDayData = () => {
    const dailyCounts: Record<string, number> = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    last7Days.forEach(date => dailyCounts[date] = 0);

    orders.forEach(order => {
      let d: Date | null = null;
      if (order.created_at?.toDate) {
        d = order.created_at.toDate();
      } else if (order.created_at) {
        d = new Date(order.created_at);
      }
      
      if (d && !isNaN(d.getTime())) {
        const date = d.toISOString().split('T')[0];
        if (dailyCounts[date] !== undefined) {
          dailyCounts[date]++;
        }
      }
    });

    return Object.entries(dailyCounts).map(([date, count]) => ({
      date: date.split('-').slice(1).join('/'),
      orders: count
    }));
  };

  const getDeliveryPerformanceData = () => {
    const statusCounts: Record<string, number> = {};
    STEPS.forEach(step => statusCounts[step] = 0);

    orders.forEach(order => {
      if (statusCounts[order.status] !== undefined) {
        statusCounts[order.status]++;
      }
    });

    return Object.entries(statusCounts)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({
        name,
        value,
        color: STATUS_COLORS[name] || "#cbd5e1"
      }));
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            setMessage({ type: "error", text: "Tệp Excel không có dữ liệu." });
            setUploading(false);
            return;
          }

          const batch = writeBatch(db);
          const now = new Date().toISOString();
          const serverTime = serverTimestamp();

          // Identify columns robustly
          const firstRow = jsonData[0];
          const headers = Object.keys(firstRow);
          const findKey = (patterns: string[]) => 
            headers.find(h => patterns.some(p => h.trim().toUpperCase().includes(p.toUpperCase())));

          const trackingKey = findKey(["MA HANG", "Mã hàng", "Mã vận đơn", "Tracking", "MA_VANDON", "BILL", "Order ID"]) || headers[0];
          const truckKey = findKey(["Mã xe", "Truck Code", "Container", "Xe", "SO XE", "BIEN SO"]);
          const statusKey = findKey(["Trạng thái", "Status", "Tinh trang", "BUOC", "STEP"]);
          const locationKey = findKey(["Vị trí", "Location", "DIEM TINH", "KHO"]);
          const destinationKey = findKey(["NOI DEN", "Nơi đến", "Destination", "Địa chỉ", "NOI_DEN", "KHO DEN"]);
          const noteKey = findKey(["GHI CHU", "Note", "Ghi chú", "Lưu ý"]);
          const customerKey = findKey(["Tên khách hàng", "Customer", "NGUOI NHAN", "KHACH HANG"]);

          // Track unique trucks to update their stats correctly
          const processedTrucks = new Set<string>();

          for (const row of jsonData) {
            const anyRow = row as any;
            const rawValue = anyRow[trackingKey!];
            if (rawValue === undefined || rawValue === null) continue;

            const rawTrackingCode = String(rawValue).trim().toUpperCase();
            // Preserve hyphens and underscores, only remove spaces
            const trackingCode = rawTrackingCode.replace(/\s+/g, "");
            
            const truckCode = truckKey ? String(anyRow[truckKey] || "").trim().toUpperCase() : "";
            const rawStatus = statusKey ? String(anyRow[statusKey] || "").trim() : "";
            const rawNote = noteKey ? String(anyRow[noteKey] || "").trim().toLowerCase() : "";
            
            // Default status if not provided
            let status = rawStatus || "Packed into truck/container";
            let location = locationKey ? String(anyRow[locationKey] || "").trim() : "China Warehouse";

            // If we have a truck code, we can infer some defaults if status is missing
            if (truckCode && !rawStatus) {
              status = "Packed into truck/container";
              location = "China Warehouse";
            }

            // Detect "Kiem hoa" keyword
            if (rawNote.includes("kiem hoa") || rawNote.includes("kiểm hoá")) {
              status = "Đang kiểm hoá tại cửa khẩu";
              location = "Border Gate";
            }
            
            const rawDestination = destinationKey ? String(anyRow[destinationKey] || "").trim() : "";
            const destination = rawDestination ? mapDestination(rawDestination) : null;
            
            if (!trackingCode) continue;

            const orderRef = doc(db, "orders", trackingCode);
            const updateData: any = {
              tracking_code: trackingCode,
              customer_name: (customerKey ? anyRow[customerKey] : null) || anyRow["Tên khách hàng"] || anyRow["Customer Name"] || "Imported via Excel",
              status: status,
              location: location,
              truck_code: truckCode || null,
              updated_at: now,
              // We only set created_at if it's a new document
            };

            if (destination && destination !== "Chưa xác định") {
              updateData.destination = destination;
            }

            // Check if document exists to preserve created_at
            batch.set(orderRef, updateData, { merge: true });

            // Ensure created_at exists (serverTimestamp only runs once on creation if we use merge correctly or handle existence)
            // Actually batch.set with merge: true is fine. 
            // Better: update created_at only if it doesn't exist
            // But we don't have getDoc in batch, so we'll just set it regularly if it's missing or let it be.
            // For simplicity in bulk, we'll just update fields.

            // Add log (History)
            const logRef = doc(collection(db, `orders/${trackingCode}/logs`));
            batch.set(logRef, {
              order_id: trackingCode,
              status: status,
              timestamp: now,
              location: location,
              note: `${truckCode ? `Loaded into truck ${truckCode}` : "Excel Import Update"}${destination ? ` - Nơi đến: ${destination}` : ""}${rawNote ? ` - Note: ${rawNote}` : ""}`
            });

            // Update Truck History
            if (truckCode) {
              processedTrucks.add(truckCode);
              const truckRef = doc(db, "trucks", truckCode);
              batch.set(truckRef, {
                truck_code: truckCode,
                status: status === "Packed into truck/container" ? "Loading" : status,
                destination: destination || "Chưa xác định",
                last_location: location,
                updated_at: now
              }, { merge: true });
            }
          }

          await batch.commit();
          setMessage({ type: "success", text: `Đã cập nhật ${jsonData.length} đơn hàng và ${processedTrucks.size} xe hàng.` });
          fetchData();
        } catch (err: any) {
          console.error("Excel processing error:", err);
          setMessage({ type: "error", text: "Lỗi khi xử lý tệp Excel." });
        } finally {
          setUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Upload error:", err);
      setMessage({ type: "error", text: "An error occurred during Excel import." });
      setUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleTruckAction = async (action: typeof TRUCK_ACTIONS[0]) => {
    if (!selectedTruck) return;

    setUploading(true);
    setMessage(null);

    try {
      const q = query(collection(db, "orders"), where("truck_code", "==", selectedTruck));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setMessage({ type: "error", text: "No orders found in this truck." });
        setUploading(false);
        return;
      }

      const batch = writeBatch(db);
      const now = new Date().toISOString();

      querySnapshot.docs.forEach(orderDoc => {
        batch.update(orderDoc.ref, {
          status: action.status,
          location: action.location,
          updated_at: now
        });

        const logRef = doc(collection(db, `orders/${orderDoc.id}/logs`));
        batch.set(logRef, {
          order_id: orderDoc.id,
          status: action.status,
          timestamp: now,
          location: action.location,
          note: `Bulk update via truck ${selectedTruck}`
        });
      });

      // Update truck status
      const truckRef = doc(db, "trucks", selectedTruck);
      batch.update(truckRef, {
        status: action.status,
        updated_at: now
      });

      await batch.commit();
      setMessage({ type: "success", text: `Updated ${querySnapshot.size} orders in truck ${selectedTruck}.` });
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Failed to update truck status." });
    } finally {
      setUploading(false);
    }
  };

  const handleTrackingSearch = async () => {
    if (!trackingSearchTerm.trim()) return;
    
    setIsSearchingTracking(true);
    try {
      const q = query(collection(db, "orders"), where("tracking_code", "==", trackingSearchTerm.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const orderData = querySnapshot.docs[0].data();
        setSearchedOrder({ id: querySnapshot.docs[0].id, ...orderData });
      } else {
        setMessage({ type: "error", text: `Không tìm thấy mã vận đơn: ${trackingSearchTerm}` });
        setSearchedOrder(null);
      }
    } catch (err) {
      console.error("Search tracking error:", err);
      setMessage({ type: "error", text: "Lỗi khi tìm kiếm mã vận đơn." });
    } finally {
      setIsSearchingTracking(false);
    }
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState<{ label: string, location: string, value?: string } | null>(null);

  const handleClearAllData = async () => {
    setUploading(true);
    try {
      const collectionsToClear = ["trucks", "orders", "orders/*/logs"]; // simplified representation
      // In reality we should clear each collection specifically
      const bulkCollections = ["trucks", "orders"];
      
      for (const collName of bulkCollections) {
        const q = query(collection(db, collName));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      setMessage({ type: "success", text: "Đã xóa toàn bộ dữ liệu thành công!" });
    } catch (error: any) {
      console.error("Clear data error:", error);
      setMessage({ type: "error", text: "Lỗi khi xóa dữ liệu." });
    } finally {
      setUploading(false);
      setShowClearConfirm(false);
    }
  };

  const BULK_STATUS_OPTIONS = [
    { label: "Đã nhận tại kho TQ", subLabel: "已入中国仓", value: "Received at China warehouse", location: "Kho Trung Quốc", color: "bg-amber-500" },
    { label: "Đã bốc hàng lên xe", subLabel: "已装车", value: "Packed into truck/container", location: "Kho Trung Quốc", color: "bg-blue-500" },
    { label: "Đã xuất kho TQ", subLabel: "中国仓已出库", value: "Outbound China", location: "Trung Quốc", color: "bg-orange-500" },
    { label: "Đang chuyển biên giới", subLabel: "边境转运中", value: "In transit to border", location: "Trung Quốc", color: "bg-purple-500" },
    { label: "Đang làm thủ tục hải quan", subLabel: "海关清关中", value: "Customs inspection", location: "Cửa khẩu", color: "bg-amber-600" },
    { label: "Hàng kiểm hoá", subLabel: "海关查验中", value: "Customs examination", location: "Cửa khẩu", color: "bg-red-500" },
    { label: "Đã thông quan", subLabel: "已清关", value: "Customs cleared", location: "Cửa khẩu", color: "bg-emerald-600" },
    { label: "Chuyển về Hà Nội", subLabel: "运往河内中", value: "Transit to Hanoi", location: "Việt Nam", color: "bg-indigo-500" },
    { label: "Đã về kho Hà Nội", subLabel: "已到河内仓", value: "Arrived Hanoi warehouse", location: "Hà Nội", color: "bg-blue-600" },
    { label: "Đang phân loại tại kho", subLabel: "仓库理货中", value: "Sorting at warehouse", location: "Kho Hà Nội", color: "bg-teal-600" },
    { label: "Đang giao hàng", subLabel: "派送中", value: "Out for delivery", location: "Người nhận", color: "bg-pink-500" },
    { label: "Đã giao hàng", subLabel: "已送达", value: "Delivered", location: "Người nhận", color: "bg-green-500" },
  ];

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.tracking_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "All" || order.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: orders.length,
    china: orders.filter(o => ["Received at China warehouse", "Packed into truck/container", "Outbound China", "In transit to border"].includes(o.status)).length,
    transit: orders.filter(o => ["Customs inspection", "Customs examination", "Customs cleared", "Transit to Hanoi"].includes(o.status)).length,
    vietnam: orders.filter(o => ["Arrived Hanoi warehouse", "Sorting at warehouse", "Out for delivery"].includes(o.status)).length,
    delivered: orders.filter(o => o.status === "Delivered").length
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto ml-0 md:ml-64 pt-24 md:pt-12">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
              {activeTab === "overview" ? "Dashboard Overview / 仪表盘概览" : 
               activeTab === "orders" ? "Manage Orders / 订单管理" : 
               activeTab === "trucks" ? "Truck Management / 车辆管理" : "System Settings / 系统设置"}
            </h2>
            <p className="text-slate-500 font-medium">Welcome back, Administrator. / 欢迎回来，管理员。</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button 
              onClick={fetchData}
              className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-600"
            >
              <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {uploading ? "Processing..." : "Import Excel"}
              </div>
              <span className="text-[10px] opacity-60">{uploading ? "处理中..." : "导入 Excel"}</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleExcelUpload} 
              accept=".xlsx,.xls" 
              className="hidden" 
            />
          </div>
        </header>

        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-xl flex items-center justify-between mb-8 font-bold text-sm border",
              message.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-error/10 border-error/20 text-error"
            )}
          >
            <div className="flex items-center gap-3">
              {message.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              {message.text}
            </div>
            <button onClick={() => setMessage(null)} className="opacity-50 hover:opacity-100">✕</button>
          </motion.div>
        )}

        {activeTab === "overview" && (
          <div className="space-y-12">
            {/* Tracking Search Form */}
            <div className="bg-white p-8 rounded-3xl shadow-xl border-b-4 border-primary">
              <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Truy vấn hành trình nhanh / 快速轨迹查询
              </h3>
              <div className="flex flex-col md:flex-row gap-4">
                <input 
                  type="text" 
                  placeholder="Nhập mã vận đơn (Ví dụ: hs432-21) / 输入单号"
                  value={trackingSearchTerm}
                  onChange={(e) => setTrackingSearchTerm(e.target.value)}
                  className="flex-1 px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-primary focus:bg-white transition-all font-bold text-lg"
                />
                <button 
                  onClick={handleTrackingSearch}
                  disabled={isSearchingTracking}
                  className="bg-primary text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-primary/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSearchingTracking ? "Đang tìm..." : "Tìm kiếm / 搜索"}
                </button>
              </div>

              {searchedOrder && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 p-6 bg-slate-50 rounded-2xl border-l-4 border-primary"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vị trí hiện tại / 当前位置</p>
                      <p className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" />
                        {searchedOrder.truck_code ? `Nằm trên xe: ${searchedOrder.truck_code}` : "Chưa bốc lên xe"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ngày bốc hàng / 装车日期</p>
                      <p className="text-lg font-black text-slate-900">
                        {safeFormatDate(searchedOrder.updated_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Trạng thái hiện tại / 当前状态</p>
                      <span className="px-3 py-1 rounded-full text-[12px] font-black uppercase tracking-tighter" style={{ backgroundColor: `${STATUS_COLORS[searchedOrder.status]}20`, color: STATUS_COLORS[searchedOrder.status] }}>
                        {searchedOrder.status}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
              <StatCard label="Total Orders" subLabel="总订单" value={stats.total} icon={<Package />} color="bg-blue-500" />
              <StatCard label="In China" subLabel="在中国" value={stats.china} icon={<MapPin />} iconSize={20} color="bg-amber-500" />
              <StatCard label="In Transit" subLabel="运输中" value={stats.transit} icon={<Truck />} color="bg-indigo-500" />
              <StatCard label="In Vietnam" subLabel="在越南" value={stats.vietnam} icon={<MapPin />} color="bg-emerald-500" />
              <StatCard label="Delivered" subLabel="已送达" value={stats.delivered} icon={<CheckCircle2 />} color="bg-green-500" />
            </div>

            {/* Bulk Update Tools */}
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Cập nhật trạng thái hàng loạt / 批量状态更新
                </h3>
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  className="px-4 py-2 bg-error/10 text-error rounded-xl font-black text-xs uppercase tracking-widest hover:bg-error/20 transition-all"
                >
                  Xóa toàn bộ dữ liệu / 删除所有数据
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {BULK_STATUS_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setBulkUpdateStatus(option)}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 border-2 border-transparent hover:border-primary hover:bg-white transition-all group"
                  >
                    <div className={cn("w-3 h-3 rounded-full mb-3", option.color)} />
                    <span className="text-sm font-black text-center text-slate-800 leading-tight">{option.label}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">{option.subLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Orders per Day / 每日订单
                    </h3>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-1">Last 7 days activity / 最近 7 天活动</p>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getOrdersPerDayData()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="orders" 
                        stroke="#6366f1" 
                        strokeWidth={4} 
                        dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Delivery Performance / 交付绩效
                    </h3>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-1">Status distribution / 状态分布</p>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getDeliveryPerformanceData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {getDeliveryPerformanceData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        iconType="circle"
                        formatter={(value) => <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Orders Preview */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black">Recent Shipments / 最近货运</h3>
                <button onClick={() => setActiveTab("orders")} className="text-sm font-bold text-primary hover:underline">View All / 查看全部</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4">Tracking Code / 运单号</th>
                      <th className="px-8 py-4">Customer / 客户</th>
                      <th className="px-8 py-4">Status / 状态</th>
                      <th className="px-8 py-4">Location / 位置</th>
                      <th className="px-8 py-4">Last Updated / 最后更新</th>
                      <th className="px-8 py-4">Actions / 操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(0, 5).map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5 font-black text-slate-900">{order.tracking_code}</td>
                        <td className="px-8 py-5 text-slate-600 font-medium">{order.customer_name}</td>
                        <td className="px-8 py-5">
                          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter" style={{ backgroundColor: `${STATUS_COLORS[order.status]}20`, color: STATUS_COLORS[order.status] }}>
                            {order.status}
                            <span className="ml-1 opacity-60">({STATUS_CN[order.status] || "未知"})</span>
                          </span>
                        </td>
                        <td className="px-8 py-5 text-slate-500 font-bold text-sm">{order.location}</td>
                        <td className="px-8 py-5 text-slate-400 text-xs font-bold">
                          {safeFormatDate(order.updated_at)}
                        </td>
                        <td className="px-8 py-5">
                          <button 
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-primary"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "vehicle_history" && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black">Lịch sử xe hàng / 车辆装载历史</h3>
                  <p className="text-sm font-medium text-slate-400">Danh sách các xe hàng đã tải lên hệ thống.</p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4">Số xe (车号)</th>
                      <th className="px-8 py-4">Ngày bốc (装车日期)</th>
                      <th className="px-8 py-4">Nơi đến (目的地)</th>
                      <th className="px-8 py-4">Tổng mã (总单)</th>
                      <th className="px-8 py-4">Vị trí cuối (最后位置)</th>
                      <th className="px-8 py-4">Trạng thái (状态)</th>
                      <th className="px-8 py-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trucks.map(truck => {
                      const truckOrders = orders.filter(o => o.truck_code === truck.truck_code);
                      return (
                        <tr key={truck.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-5 font-black text-slate-900">{truck.truck_code}</td>
                          <td className="px-8 py-5 text-slate-600 font-bold text-sm">
                            {safeFormatDate(truck.updated_at)}
                          </td>
                          <td className="px-8 py-5 text-slate-500 font-bold text-sm">
                            {truck.destination || "-"}
                          </td>
                          <td className="px-8 py-5">
                            <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                              {truckOrders.length} mã
                            </span>
                          </td>
                          <td className="px-8 py-5 text-slate-500 font-medium text-xs">
                            {truck.last_location || "-"}
                          </td>
                          <td className="px-8 py-5">
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter" style={{ backgroundColor: `${STATUS_COLORS[truck.status]}20`, color: STATUS_COLORS[truck.status] }}>
                              {truck.status}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <button 
                              onClick={() => {
                                setSelectedTruck(truck.truck_code);
                                setActiveTab("trucks");
                              }}
                              className="text-primary font-bold text-xs bg-primary/10 px-3 py-2 rounded-lg hover:bg-primary/20 transition-all"
                            >
                              Chi tiết / 详情
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-8">
            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                <input 
                  type="text" 
                  placeholder="Search by tracking code or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:border-primary focus:ring-0 transition-all font-bold text-sm"
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="text-slate-400 h-5 w-5" />
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-50 border-transparent rounded-xl px-4 py-3 font-bold text-sm focus:bg-white focus:border-primary focus:ring-0 transition-all"
                >
                  <option value="All">All Statuses</option>
                  {STEPS.map(step => <option key={step} value={step}>{step}</option>)}
                </select>
              </div>
            </div>

            {/* Full Orders Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4">Tracking Code</th>
                      <th className="px-8 py-4">Customer</th>
                      <th className="px-8 py-4">Truck</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4">Location</th>
                      <th className="px-8 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5 font-black text-slate-900">{order.tracking_code}</td>
                        <td className="px-8 py-5 text-slate-600 font-medium">{order.customer_name}</td>
                        <td className="px-8 py-5">
                          {order.truck_code ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-slate-500">
                              <Truck className="h-3 w-3" />
                              {order.truck_code}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-8 py-5">
                          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-blue-50 text-blue-600 border border-blue-100">
                            {order.status}
                            <span className="ml-1 opacity-60">({STATUS_CN[order.status] || "未知"})</span>
                          </span>
                        </td>
                        <td className="px-8 py-5 text-slate-500 font-bold text-sm">{order.location}</td>
                        <td className="px-8 py-5">
                          <button 
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-primary"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {bulkUpdateStatus && (
            <BulkUpdateModal 
              status={bulkUpdateStatus.value || bulkUpdateStatus.label}
              location={bulkUpdateStatus.location}
              onClose={() => setBulkUpdateStatus(null)}
              onSuccess={(count) => {
                setBulkUpdateStatus(null);
                setMessage({ type: "success", text: `Đã cập nhật hàng loạt thành công ${count} đơn hàng!` });
              }}
            />
          )}

          {showClearConfirm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-on-surface/40 backdrop-blur-md p-6">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center">
                <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-black mb-2">Xác nhận xóa hết?</h3>
                <p className="text-slate-500 font-medium mb-8">Hành động này sẽ xóa toàn bộ Đơn hàng và Xe hàng. Bạn có chắc chắn muốn tiếp tục?</p>
                <div className="flex gap-4">
                  <button onClick={() => setShowClearConfirm(false)} className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 font-black">Hủy</button>
                  <button onClick={handleClearAllData} className="flex-1 px-6 py-4 rounded-2xl bg-error text-white font-black shadow-lg shadow-error/30">Xóa dữ liệu</button>
                </div>
              </div>
            </div>
          )}

          {selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl rounded-3xl bg-white p-10 shadow-2xl overflow-hidden relative"
              >
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="absolute right-6 top-6 rounded-full bg-slate-100 p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                >
                  <MoreHorizontal className="h-5 w-5 rotate-90" />
                </button>

                <div className="flex items-center gap-4 mb-8">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Package className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">{selectedOrder.tracking_code}</h3>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Order Details / 订单详情</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Name / 客户姓名</p>
                    <p className="font-bold text-slate-900">{selectedOrder.customer_name || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Status / 当前状态</p>
                    <div className="inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter" style={{ backgroundColor: `${STATUS_COLORS[selectedOrder.status]}20`, color: STATUS_COLORS[selectedOrder.status] }}>
                      {selectedOrder.status} ({STATUS_CN[selectedOrder.status] || "未知"})
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Location / 当前位置</p>
                    <p className="font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {selectedOrder.location}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Truck Assigned / 所属车辆</p>
                    <p className="font-bold text-slate-900 flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      {selectedOrder.truck_code || "Unassigned / 未分配"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight / Volume (重量 / 体积)</p>
                    <p className="font-bold text-slate-900">{selectedOrder.weight || 0}kg / {selectedOrder.volume || 0}m³</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cost / 总费用</p>
                    <p className="font-bold text-primary">
                      {selectedOrder.total_cost ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedOrder.total_cost) : "N/A"}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Raw Data / Metadata (原始数据)</h4>
                  <div className="max-h-40 overflow-y-auto text-[10px] font-mono text-slate-500 space-y-1">
                    {Object.entries(selectedOrder.details || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between border-b border-slate-200 py-1">
                        <span className="font-bold">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={() => setSelectedOrder(null)}
                    className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {activeTab === "trucks" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Truck List */}
            <div className="lg:col-span-4 space-y-4">
              <h3 className="text-xl font-black mb-6">Active Trucks</h3>
              {trucks.map(truck => (
                <button 
                  key={truck.id}
                  onClick={() => setSelectedTruck(truck.truck_code)}
                  className={cn(
                    "w-full p-6 rounded-2xl border text-left transition-all",
                    selectedTruck === truck.truck_code 
                      ? "bg-primary text-white border-primary shadow-xl shadow-primary/20 scale-[1.02]" 
                      : "bg-white border-slate-100 hover:border-primary/30 text-slate-900"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-widest opacity-60">Truck ID</span>
                    <Truck className="h-4 w-4 opacity-40" />
                  </div>
                  <p className="text-xl font-black mb-4">{truck.truck_code}</p>
                  <div className={cn(
                    "inline-block px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter",
                    selectedTruck === truck.truck_code ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  )}>
                    {truck.status}
                  </div>
                </button>
              ))}
              {trucks.length === 0 && (
                <div className="p-12 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="font-bold">No active trucks found.</p>
                </div>
              )}
            </div>

            {/* Truck Actions */}
            <div className="lg:col-span-8">
              <AnimatePresence mode="wait">
                {selectedTruck ? (
                  <motion.div 
                    key={selectedTruck}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white rounded-3xl p-10 shadow-xl border border-slate-100"
                  >
                    <div className="flex items-center justify-between mb-10">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900">Truck: {selectedTruck}</h3>
                        <p className="text-slate-500 font-medium">Bulk update all orders inside this truck.</p>
                      </div>
                      <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Count</p>
                        <p className="text-xl font-black text-primary">
                          {orders.filter(o => o.truck_code === selectedTruck).length}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {TRUCK_ACTIONS.map(action => (
                        <button 
                          key={action.label}
                          onClick={() => handleTruckAction(action)}
                          disabled={uploading}
                          className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 border-2 border-transparent hover:border-primary hover:bg-white transition-all group"
                        >
                          <div className="text-left">
                            <p className="font-black text-slate-900 group-hover:text-primary transition-colors">
                              {action.label}
                              <span className="block text-[10px] font-bold text-slate-400 opacity-60 leading-none mt-1">{action.subLabel}</span>
                            </p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-tight mt-1">{action.status}</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                    </div>

                    <div className="mt-12 p-6 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
                      <AlertCircle className="text-amber-500 h-6 w-6 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-800 font-bold">Important Notice</p>
                        <p className="text-sm text-amber-700/80 mt-1">Updating truck status will automatically update the status and location of ALL {orders.filter(o => o.truck_code === selectedTruck).length} orders assigned to this truck. This action will also create a tracking log for each order.</p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full flex items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 p-20">
                    <div className="text-center">
                      <Truck className="h-16 w-16 mx-auto mb-6 opacity-10" />
                      <h3 className="text-xl font-black text-slate-300">Select a truck to manage</h3>
                      <p className="mt-2 font-medium">Choose a truck from the left panel to perform bulk updates.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <AdminSettings />
        )}
      </main>
    </div>
  );
}

function StatCard({ label, subLabel, value, icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 group hover:scale-[1.02] transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-lg text-white", color)}>
          {icon}
        </div>
        <div className="h-1 w-8 bg-slate-100 rounded-full" />
      </div>
      <div className="space-y-0.5">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">{label}</p>
        {subLabel && <p className="text-[10px] font-bold text-slate-400 opacity-60 leading-none">{subLabel}</p>}
      </div>
      <p className="text-3xl font-black text-slate-900 mt-2">{value}</p>
    </div>
  );
}
