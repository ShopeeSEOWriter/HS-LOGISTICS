import React, { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import * as XLSX from "xlsx";
import { doc, setDoc, writeBatch, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

interface ExcelUploadProps {
  onSuccess?: (results: any[]) => void;
}

export default function ExcelUpload({ onSuccess }: ExcelUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [truckCode, setTruckCode] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError("Vui lòng tải lên tệp Excel (.xlsx hoặc .xls)");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!truckCode.trim()) {
      setError("Vui lòng nhập mã xe/container");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            setError("Tệp Excel không có dữ liệu.");
            setIsUploading(false);
            return;
          }

          const batch = writeBatch(db);
          const truckId = truckCode.trim();
          const truckRef = doc(db, "trucks", truckId);

          // Create or update truck
          batch.set(truckRef, {
            truck_code: truckId,
            status: "Đã bốc hàng",
            location: "Đông Hưng",
            order_count: jsonData.length,
            last_updated: serverTimestamp(),
          }, { merge: true });

          // Create orders
          jsonData.forEach((row: any) => {
            const trackingCode = String(row["Mã vận đơn"] || row["Tracking Code"] || row["Mã đơn"] || "").trim();
            if (trackingCode) {
              const orderRef = doc(db, "orders", trackingCode);
              batch.set(orderRef, {
                tracking_code: trackingCode,
                truck_id: truckId,
                status: "Đã bốc hàng",
                location: "Đông Hưng",
                last_updated: serverTimestamp(),
                details: row,
              }, { merge: true });
            }
          });

          await batch.commit();
          
          setSuccess(true);
          setFile(null);
          setTruckCode("");
          if (onSuccess) onSuccess(jsonData);
        } catch (err: any) {
          console.error("Excel processing error:", err);
          setError("Lỗi khi xử lý tệp Excel.");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setError("Lỗi khi đọc tệp.");
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-8">
        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
          Mã xe / Container ID / 车号
        </label>
        <input 
          type="text" 
          value={truckCode}
          onChange={(e) => setTruckCode(e.target.value)}
          placeholder="Ví dụ: HS3128-31, TRUCK_001..."
          className="w-full rounded-2xl border-2 border-surface-container-high bg-surface-container-lowest px-6 py-4 font-headline text-lg font-black focus:border-primary focus:ring-0"
        />
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 transition-all duration-300",
          isDragging ? "border-primary bg-primary/5" : "border-surface-container-high bg-surface-container-lowest",
          file ? "border-primary/50" : ""
        )}
      >
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={isUploading}
        />

        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-container shadow-inner">
          {isUploading ? (
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          ) : file ? (
            <FileText className="h-10 w-10 text-primary" />
          ) : (
            <Upload className="h-10 w-10 text-on-surface-variant/40" />
          )}
        </div>

        <div className="text-center">
          <h3 className="font-headline text-xl font-bold text-on-surface">
            {file ? file.name : "Kéo và thả tệp Excel vào đây"}
          </h3>
          <p className="mt-2 text-sm text-on-surface-variant/60">
            {file ? `${(file.size / 1024).toFixed(2)} KB` : "Hoặc nhấp để chọn tệp từ máy tính của bạn"}
          </p>
        </div>

        {file && !isUploading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUpload();
            }}
            className="mt-8 rounded-full bg-on-background px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
          >
            Bắt đầu nhập dữ liệu
          </button>
        )}
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-error/10 p-4 text-error">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary-container/20 p-4 text-secondary">
          <CheckCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Tải lên thành công! Dữ liệu đã được cập nhật.</span>
        </div>
      )}
    </div>
  );
}
