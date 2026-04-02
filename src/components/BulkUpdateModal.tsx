import React, { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { cn } from "../lib/utils";
import * as XLSX from "xlsx";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { notificationService } from "../services/notificationService";

interface BulkUpdateModalProps {
  status: string;
  location: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export default function BulkUpdateModal({ status, location, onClose, onSuccess }: BulkUpdateModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setIsUploading(true);
    setError(null);

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
          let count = 0;
          const trackingCodes: string[] = [];

          jsonData.forEach((row: any) => {
            const trackingCode = String(row["Mã vận đơn"] || row["Tracking Code"] || row["Mã đơn"] || "").trim();
            if (trackingCode) {
              const orderRef = doc(db, "orders", trackingCode);
              batch.update(orderRef, {
                status: status,
                location: location,
                last_updated: serverTimestamp(),
              });
              trackingCodes.push(trackingCode);
              count++;
            }
          });

          await batch.commit();
          
          // Notify users
          if (trackingCodes.length > 0) {
            await notificationService.notifyBulkStatusUpdate(trackingCodes, status, location);
          }
          
          onSuccess(count);
        } catch (err: any) {
          console.error("Bulk update processing error:", err);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-md p-6">
      <div className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-300 rounded-[2.5rem] bg-surface-container-lowest p-10 shadow-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h3 className="font-headline text-3xl font-black text-on-surface">Cập nhật hàng loạt</h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-primary">Trạng thái: {status}</p>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full bg-surface-container-high p-3 text-on-surface-variant transition-all hover:bg-error/10 hover:text-error"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-8 rounded-2xl bg-primary/5 p-6 border border-primary/10">
          <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
            Hệ thống sẽ tự động tìm cột <span className="font-bold text-primary">"Mã vận đơn"</span> và <span className="font-bold text-primary">"Nơi đến"</span> (HN, SG, HP...) trong file Excel để cập nhật trạng thái <span className="font-bold text-on-surface">"{status}"</span>.
          </p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed p-12 transition-all duration-300",
            isDragging ? "border-primary bg-primary/5" : "border-surface-container-high bg-surface-container-low",
            file ? "border-primary/50 bg-primary/5" : ""
          )}
        >
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isUploading}
          />

          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-surface-container-lowest shadow-editorial">
            {isUploading ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            ) : file ? (
              <FileText className="h-12 w-12 text-primary" />
            ) : (
              <Upload className="h-12 w-12 text-on-surface-variant/40" />
            )}
          </div>

          <div className="text-center">
            <h3 className="font-headline text-xl font-bold text-on-surface">
              {file ? file.name : "Kéo và thả tệp Excel vào đây"}
            </h3>
            <p className="mt-2 text-sm font-medium text-on-surface-variant/60">
              {file ? `${(file.size / 1024).toFixed(2)} KB` : "Hoặc nhấp để chọn tệp từ máy tính của bạn"}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-error/10 p-4 text-error">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        <div className="mt-10 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-surface-container-high py-4 text-sm font-bold text-on-surface transition-all hover:bg-surface-container-highest"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="flex-[2] signature-gradient rounded-2xl py-4 text-sm font-bold text-on-primary shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {isUploading ? "Đang xử lý..." : "Bắt đầu cập nhật"}
          </button>
        </div>
      </div>
    </div>
  );
}
