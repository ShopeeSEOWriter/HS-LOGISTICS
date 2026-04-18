import React, { useState, useCallback, useEffect } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Table, Trash2, Save, History } from "lucide-react";
import { cn, mapDestination } from "../lib/utils";
import * as XLSX from "xlsx";
import { doc, setDoc, writeBatch, collection, serverTimestamp, addDoc, getDoc, arrayUnion } from "firebase/firestore";
import { db } from "../lib/firebase";
import { notificationService } from "../services/notificationService";
import { handleFirestoreError, OperationType } from "../lib/errorHandler";

interface ExcelUploadProps {
  onSuccess?: (results: any[]) => void;
}

interface PreviewRow {
  truck_code: string;
  tracking_code: string;
  [key: string]: any;
}

import { getShippingSettings, calculateShippingFee, PRODUCT_CATEGORIES } from "../services/settingsService";

export default function ExcelUpload({ onSuccess }: ExcelUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [lastUploadCount, setLastUploadCount] = useState<number>(0);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const s = await getShippingSettings();
      setSettings(s);
    };
    fetchSettings();
  }, []);

  const processFile = (selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          setError("Tệp Excel không có dữ liệu.");
          return;
        }

        // Map columns
        const firstRow = jsonData[0];
        const keys = Object.keys(firstRow);
        
        const findKey = (patterns: string[]) => 
          keys.find(k => patterns.some(p => k.trim().toUpperCase().includes(p.toUpperCase())));

        const truckKey = findKey(["Truck Code", "Mã xe", "Container", "Xe", "Mã container"]) || "";
        const trackingKey = findKey(["Tracking Code", "Mã vận đơn", "Mã đơn", "Bill", "Mã số", "Mã kiện", "Mã hàng", "MA HANG"]) || "";
        const weightKey = findKey(["Weight", "Cân nặng", "Khối lượng", "Kg"]) || "";
        const volumeKey = findKey(["Volume", "Thể tích", "Khối", "M3"]) || "";
        const destinationKey = findKey(["NOI DEN", "Destination", "Nơi đến", "Địa chỉ", "NOI_DEN"]) || "";
        const itemTypeKey = findKey(["Item Type", "Mặt hàng", "Loại hàng"]) || "";
        const noteKey = findKey(["GHI CHU", "Note", "Ghi chú", "Lưu ý"]);

        if (!trackingKey) {
          setError("Không tìm thấy cột 'Mã vận đơn', 'Tracking Code', 'Mã số', 'Mã kiện' hoặc 'Mã hàng'.");
          return;
        }

        const formattedData: PreviewRow[] = jsonData.map(row => {
          const rawDest = String(row[destinationKey] || "").trim();
          const destination = mapDestination(rawDest);
          const rawNote = noteKey ? String(row[noteKey] || "").trim().toLowerCase() : "";
          const rawItemType = String(row[itemTypeKey] || "").trim();
          
          // Map item type to ID
          let categoryId = "pho_thong";
          const matchedCategory = PRODUCT_CATEGORIES.find(c => 
            c.label.toLowerCase().includes(rawItemType.toLowerCase()) || 
            rawItemType.toLowerCase().includes(c.label.toLowerCase())
          );
          if (matchedCategory) categoryId = matchedCategory.id;

          let status = "Đã bốc hàng lên xe";
          let location = "Kho Trung Quốc";

          if (rawNote.includes("kiem hoa") || rawNote.includes("kiểm hoá")) {
            status = "Đang kiểm hoá tại cửa khẩu";
            location = "Border Gate";
          }
          
          return {
            // Normalize: Preserve hyphens and other characters, only remove spaces
            truck_code: String(row[truckKey] || "CHƯA XÁC ĐỊNH").trim().toUpperCase().replace(/\s+/g, ""),
            tracking_code: String(row[trackingKey] || "").trim().toUpperCase().replace(/\s+/g, ""),
            weight: parseFloat(row[weightKey]) || 0,
            volume: parseFloat(row[volumeKey]) || 0,
            destination: destination,
            item_type: categoryId, // Store ID
            status: status,
            location: location,
            ...row
          };
        }).filter(row => row.tracking_code !== "");

        // Check for duplicates in file
        const seen = new Set<string>();
        const dups: string[] = [];
        formattedData.forEach(row => {
          if (seen.has(row.tracking_code)) {
            dups.push(row.tracking_code);
          }
          seen.add(row.tracking_code);
        });

        setPreviewData(formattedData);
        setDuplicates(dups);
        setFile(selectedFile);
        setError(null);
        setSuccess(false);
      } catch (err) {
        console.error(err);
        setError("Lỗi khi xử lý tệp Excel.");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      processFile(droppedFile);
    } else {
      setError("Vui lòng tải lên tệp Excel (.xlsx hoặc .xls)");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (previewData.length === 0) return;
    if (duplicates.length > 0) {
      setError("Vui lòng loại bỏ các mã vận đơn trùng lặp trong tệp trước khi nhập.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const trucksToUpdate = new Set<string>();

      // Group by truck and prepare orders
      for (const row of previewData) {
        const { truck_code, tracking_code, weight, volume, destination, item_type, status, location } = row;
        trucksToUpdate.add(truck_code);

        const { totalCost, pricePerKg, pricePerM3 } = calculateShippingFee(weight, volume, item_type, settings, destination);
        const historyEntry = {
          status: status || "Đã bốc hàng lên xe",
          location: location || "Kho Trung Quốc",
          timestamp: now,
          note: status === "Đang kiểm hoá tại cửa khẩu" 
            ? `Hàng đang được kiểm hoá tại cửa khẩu (Nhập từ Excel)`
            : `Hàng đã được bốc lên xe ${truck_code} (Nhập từ Excel)`
        };

        const orderRef = doc(db, "orders", tracking_code);
        batch.set(orderRef, {
          tracking_code,
          truck_code,
          weight,
          volume,
          destination,
          item_type,
          price_per_kg: pricePerKg,
          price_per_m3: pricePerM3,
          total_cost: totalCost,
          status: status || "Đã bốc hàng lên xe",
          location: location || "Kho Trung Quốc",
          last_updated: serverTimestamp(),
          history: arrayUnion(historyEntry),
          details: row,
        }, { merge: true });

        // Add tracking log
        const logId = `log_${tracking_code}_loaded_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const logRef = doc(db, "tracking_logs", logId);
        batch.set(logRef, {
          tracking_code,
          status: status || "Đã bốc hàng lên xe",
          timestamp: now,
          location: location || "Kho Trung Quốc",
          note: status === "Đang kiểm hoá tại cửa khẩu" 
            ? `Hàng đang được kiểm hoá tại cửa khẩu (Nhập từ Excel)`
            : `Hàng đã được bốc lên xe ${truck_code} (Nhập từ Excel)`
        });
      }

      // Update trucks
      for (const tCode of Array.from(trucksToUpdate)) {
        const truckRef = doc(db, "trucks", tCode);
        const truckOrders = previewData.filter(r => r.truck_code === tCode);
        const truckDestination = truckOrders.length > 0 ? truckOrders[0].destination : "Chưa xác định";
        
        batch.set(truckRef, {
          truck_code: tCode,
          status: "Đã bốc hàng",
          location: "Đông Hưng",
          destination: truckDestination,
          order_count: truckOrders.length,
          last_updated: serverTimestamp(),
        }, { merge: true });
      }

      // Save import history
      const historyRef = collection(db, "import_history");
      await addDoc(historyRef, {
        filename: file?.name,
        timestamp: now,
        total_rows: previewData.length,
        truck_count: trucksToUpdate.size,
        status: "Success"
      });

      try {
        await batch.commit();
      } catch (batchErr) {
        handleFirestoreError(batchErr, OperationType.WRITE, "orders/trucks/logs (bulk)");
      }
      
      setLastUploadCount(previewData.length);
      setSuccess(true);
      setFile(null);
      setPreviewData([]);
      setDuplicates([]);
      
      // Notify user clearly as requested
      alert(`Đã nạp ${previewData.length} vận đơn vào hệ thống. Bạn có thể tìm kiếm ngay bây giờ.`);
      
      if (onSuccess) onSuccess(previewData);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError("Lỗi khi lưu dữ liệu vào hệ thống.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewData([]);
    setDuplicates([]);
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed p-20 transition-all duration-500",
            isDragging ? "border-primary bg-primary/5 scale-[0.98]" : "border-surface-container-high bg-surface-container-lowest shadow-editorial",
          )}
        >
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isUploading}
          />

          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-surface-container shadow-inner transition-transform group-hover:scale-110">
            <Upload className="h-12 w-12 text-primary" />
          </div>

          <div className="text-center">
            <h3 className="font-headline text-3xl font-black text-on-surface">
              Tải lên danh sách vận chuyển
            </h3>
            <p className="mt-4 text-sm font-medium text-on-surface-variant/60">
              Kéo và thả tệp .xlsx hoặc .xls vào đây để bắt đầu xử lý
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <span className="rounded-full bg-surface-container px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Hỗ trợ .xlsx</span>
              <span className="rounded-full bg-surface-container px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tối đa 5000 dòng</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* File Info Card */}
          <div className="flex items-center justify-between rounded-3xl bg-surface-container-lowest p-8 shadow-editorial border border-primary/10">
            <div className="flex items-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-headline text-xl font-bold text-on-surface">{file.name}</h3>
                <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest">
                  {(file.size / 1024).toFixed(2)} KB • {previewData.length} dòng dữ liệu
                </p>
              </div>
            </div>
            <button 
              onClick={removeFile}
              className="rounded-full bg-error/10 p-3 text-error transition-all hover:bg-error hover:text-white"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          {/* Duplicates Warning */}
          {duplicates.length > 0 && (
            <div className="flex items-start gap-4 rounded-3xl bg-error/10 p-6 text-error border border-error/20">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <div>
                <h4 className="font-bold">Phát hiện mã vận đơn trùng lặp!</h4>
                <p className="mt-1 text-sm opacity-80">Có {duplicates.length} mã bị trùng trong tệp. Vui lòng kiểm tra lại dữ liệu trước khi nhập.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {duplicates.slice(0, 5).map(d => (
                    <span key={d} className="rounded-md bg-error/20 px-2 py-1 text-[10px] font-bold">{d}</span>
                  ))}
                  {duplicates.length > 5 && <span className="text-[10px] font-bold">...và {duplicates.length - 5} mã khác</span>}
                </div>
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-editorial border border-surface-container">
            <div className="border-b border-surface-container p-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="h-5 w-5 text-primary" />
                <h4 className="font-headline text-lg font-bold">Xem trước dữ liệu</h4>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Hiển thị 10 dòng đầu tiên</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-low/50">
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-on-surface-variant">Mã xe</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-on-surface-variant">Mã vận đơn</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-on-surface-variant">Thông tin bổ sung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/30">
                  {previewData.slice(0, 10).map((row, i) => (
                    <tr key={i} className="hover:bg-surface-bright transition-colors">
                      <td className="px-6 py-4">
                        <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{row.truck_code}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-on-surface">{row.tracking_code}</td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant/60">
                        {Object.keys(row).filter(k => k !== 'truck_code' && k !== 'tracking_code').slice(0, 2).map(k => `${k}: ${row[k]}`).join(' | ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={handleUpload}
              disabled={isUploading || duplicates.length > 0}
              className={cn(
                "group relative flex items-center gap-3 rounded-full bg-on-background px-12 py-5 text-lg font-black text-white shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100",
                isUploading && "pr-16"
              )}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Đang xử lý dữ liệu...</span>
                </>
              ) : (
                <>
                  <Save className="h-6 w-6" />
                  <span>Xác nhận nhập {previewData.length} đơn hàng</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {error && !file && (
        <div className="mt-8 flex items-center gap-4 rounded-3xl bg-error/10 p-6 text-error border border-error/20 animate-in shake duration-500">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-[2.5rem] bg-secondary-container/20 p-12 text-secondary border-2 border-secondary/20 animate-in zoom-in duration-500">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary/10">
            <CheckCircle className="h-12 w-12" />
          </div>
          <div className="text-center">
            <h3 className="font-headline text-3xl font-black">Nhập dữ liệu thành công!</h3>
            <p className="mt-2 text-sm font-medium opacity-80">Đã cập nhật thành công {lastUploadCount} mã vận đơn vào hệ thống.</p>
          </div>
          <button 
            onClick={() => setSuccess(false)}
            className="mt-4 rounded-full bg-secondary px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90"
          >
            Tiếp tục tải lên
          </button>
        </div>
      )}
    </div>
  );
}
