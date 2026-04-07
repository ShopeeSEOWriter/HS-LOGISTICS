import React, { useState, useEffect, useRef } from "react";
import { collection, query, getDocs, doc, updateDoc, addDoc, serverTimestamp, where, writeBatch, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
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
  "Đang kiểm hoá tại cửa khẩu": "#f97316", // Dark Orange
  "Customs clearance": "#6366f1",
  "Arrived Vietnam": "#10b981",
  "Đang vận chuyển về Hà Nội": "#34d399",
  "Arrived Hanoi warehouse": "#059669",
  "Out for delivery": "#8b5cf6",
  "Delivered": "#22c55e"
};

const TRUCK_ACTIONS = [
  { label: "Đã bốc hàng lên xe", status: "Packed into truck/container", location: "China Warehouse" },
  { label: "Đang làm thủ tục hải quan", status: "Customs clearance", location: "Border Gate" },
  { label: "Đã sang Việt Nam", status: "Arrived Vietnam", location: "Vietnam Border" },
  { label: "Đang vận chuyển về Hà Nội", status: "Đang vận chuyển về Hà Nội", location: "Việt Nam" },
  { label: "Đã về kho Hà Nội", status: "Arrived Hanoi warehouse", location: "Hanoi Warehouse" },
  { label: "Đang giao hàng", status: "Out for delivery", location: "On Delivery Vehicle" },
  { label: "Đã giao hàng", status: "Delivered", location: "Customer Address" }
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [uploading, setUploading] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const ordersSnapshot = await getDocs(collection(db, "orders"));
      const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);

      const trucksSnapshot = await getDocs(collection(db, "trucks"));
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

          // Identify columns robustly
          const firstRow = jsonData[0];
          const headers = Object.keys(firstRow);
          const findKey = (patterns: string[]) => 
            headers.find(h => patterns.some(p => h.trim().toUpperCase().includes(p.toUpperCase())));

          const trackingKey = findKey(["MA HANG", "Mã hàng", "Mã vận đơn", "Tracking", "MA_VANDON", "BILL"]) || headers[0];
          const truckKey = findKey(["Mã xe", "Truck Code", "Container", "Xe"]);
          const statusKey = findKey(["Trạng thái", "Status", "Tinh trang"]);
          const destinationKey = findKey(["NOI DEN", "Nơi đến", "Destination", "Địa chỉ", "NOI_DEN"]);
          const noteKey = findKey(["GHI CHU", "Note", "Ghi chú", "Lưu ý"]);

          for (const row of jsonData) {
            const anyRow = row as any;
            const rawValue = anyRow[trackingKey!];
            if (rawValue === undefined || rawValue === null) continue;

            const rawTrackingCode = String(rawValue).trim().toUpperCase();
            // Preserve hyphens, only remove spaces
            const trackingCode = rawTrackingCode.replace(/\s+/g, "");
            
            const truckCode = truckKey ? String(anyRow[truckKey] || "").trim() : "";
            const rawStatus = statusKey ? String(anyRow[statusKey] || "").trim() : "";
            const rawNote = noteKey ? String(anyRow[noteKey] || "").trim().toLowerCase() : "";
            
            let status = rawStatus || "Packed into truck/container";
            let location = anyRow["Vị trí"] || anyRow["Location"] || "China Warehouse";

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
              customer_name: anyRow["Tên khách hàng"] || anyRow["Customer Name"] || "Imported via Excel",
              status: status,
              location: location,
              truck_code: truckCode || null,
              updated_at: now,
              created_at: serverTimestamp(),
            };

            if (destination && destination !== "Chưa xác định") {
              updateData.destination = destination;
            }

            batch.set(orderRef, updateData, { merge: true });

            // Add log
            const logRef = doc(collection(db, `orders/${trackingCode}/logs`));
            batch.set(logRef, {
              order_id: trackingCode,
              status: status,
              timestamp: now,
              location: anyRow["Vị trí"] || anyRow["Location"] || "China Warehouse",
              note: `${truckCode ? `Loaded into truck ${truckCode}` : "Imported via Excel"}${destination ? ` - Nơi đến: ${destination}` : ""}`
            });

            if (truckCode) {
              const truckRef = doc(db, "trucks", truckCode);
              batch.set(truckRef, {
                truck_code: truckCode,
                status: "Loading",
                destination: destination || "Chưa xác định",
                updated_at: now
              }, { merge: true });
            }
          }

          await batch.commit();
          setMessage({ type: "success", text: `Successfully updated ${jsonData.length} orders.` });
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
      handleFirestoreError(err, OperationType.WRITE, `trucks/${selectedTruck}/bulk_update`);
      setMessage({ type: "error", text: "Failed to update truck status." });
    } finally {
      setUploading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.tracking_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "All" || order.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: orders.length,
    china: orders.filter(o => o.status.includes("China")).length,
    transit: orders.filter(o => o.status.includes("transit") || o.status.includes("Departed") || o.status.includes("Customs")).length,
    vietnam: orders.filter(o => o.status.includes("Vietnam") || o.status.includes("Hanoi")).length,
    delivered: orders.filter(o => o.status === "Delivered").length
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col sticky top-0 h-screen">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-primary p-2 rounded-lg">
            <Truck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-black tracking-tight">ADMIN</h1>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <SidebarItem 
            icon={<LayoutDashboard className="h-5 w-5" />} 
            label="Overview" 
            active={activeTab === "overview"} 
            onClick={() => setActiveTab("overview")} 
          />
          <SidebarItem 
            icon={<Package className="h-5 w-5" />} 
            label="Orders" 
            active={activeTab === "orders"} 
            onClick={() => setActiveTab("orders")} 
          />
          <SidebarItem 
            icon={<Truck className="h-5 w-5" />} 
            label="Trucks" 
            active={activeTab === "trucks"} 
            onClick={() => setActiveTab("trucks")} 
          />
          <SidebarItem 
            icon={<Settings className="h-5 w-5" />} 
            label="Settings" 
            active={activeTab === "settings"} 
            onClick={() => setActiveTab("settings")} 
          />
        </nav>

        <div className="p-6 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors font-bold text-sm w-full"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl font-black text-slate-900">
              {activeTab === "overview" ? "Dashboard Overview" : 
               activeTab === "orders" ? "Manage Orders" : 
               activeTab === "trucks" ? "Truck Management" : "System Settings"}
            </h2>
            <p className="text-slate-500 font-medium">Welcome back, Administrator.</p>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={fetchData}
              className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-600"
            >
              <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              {uploading ? "Processing..." : "Import Excel"}
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
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <StatCard label="Total Orders" value={stats.total} icon={<Package />} color="bg-blue-500" />
              <StatCard label="In China" value={stats.china} icon={<MapPin />} color="bg-amber-500" />
              <StatCard label="In Transit" value={stats.transit} icon={<Truck />} color="bg-indigo-500" />
              <StatCard label="In Vietnam" value={stats.vietnam} icon={<MapPin />} color="bg-emerald-500" />
              <StatCard label="Delivered" value={stats.delivered} icon={<CheckCircle2 />} color="bg-green-500" />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Orders per Day
                    </h3>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-1">Last 7 days activity</p>
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
                      Delivery Performance
                    </h3>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-1">Status distribution</p>
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
                <h3 className="text-xl font-black">Recent Shipments</h3>
                <button onClick={() => setActiveTab("orders")} className="text-sm font-bold text-primary hover:underline">View All</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4">Tracking Code</th>
                      <th className="px-8 py-4">Customer</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4">Location</th>
                      <th className="px-8 py-4">Last Updated</th>
                      <th className="px-8 py-4">Actions</th>
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
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Order Details</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Name</p>
                    <p className="font-bold text-slate-900">{selectedOrder.customer_name || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Status</p>
                    <div className="inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter" style={{ backgroundColor: `${STATUS_COLORS[selectedOrder.status]}20`, color: STATUS_COLORS[selectedOrder.status] }}>
                      {selectedOrder.status}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Location</p>
                    <p className="font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {selectedOrder.location}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Truck Assigned</p>
                    <p className="font-bold text-slate-900 flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      {selectedOrder.truck_code || "Unassigned"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight / Volume</p>
                    <p className="font-bold text-slate-900">{selectedOrder.weight || 0}kg / {selectedOrder.volume || 0}m³</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cost</p>
                    <p className="font-bold text-primary">
                      {selectedOrder.total_cost ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedOrder.total_cost) : "N/A"}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Raw Data / Metadata</h4>
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
                            <p className="font-black text-slate-900 group-hover:text-primary transition-colors">{action.label}</p>
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

function SidebarItem({ icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-6 py-4 rounded-xl font-bold text-sm transition-all",
        active ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 group hover:scale-[1.02] transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-lg text-white", color)}>
          {icon}
        </div>
        <div className="h-1 w-8 bg-slate-100 rounded-full" />
      </div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
    </div>
  );
}
