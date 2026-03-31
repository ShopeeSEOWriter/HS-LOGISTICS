import React, { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

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

    const formData = new FormData();
    formData.append("file", file);
    formData.append("truckCode", truckCode.trim());

    try {
      const response = await fetch("/api/admin/upload-excel", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setFile(null);
        setTruckCode("");
        if (onSuccess) onSuccess(result.results);
      } else {
        setError(result.error || "Có lỗi xảy ra khi tải lên tệp.");
      }
    } catch (err: any) {
      setError("Lỗi kết nối máy chủ.");
    } finally {
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
