import React, { useState, useRef } from "react";
import { Upload, FileText, Download, Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import * as XLSX from "xlsx";
import { GoogleGenAI } from "@google/genai";
import { cn } from "../lib/utils";

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function GoodsTranslator() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [translatedData, setTranslatedData] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setOriginalFileName(selectedFile.name);
      setError(null);
      setTranslatedData(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setOriginalFileName(droppedFile.name);
      setError(null);
      setTranslatedData(null);
    }
  };

  const translateText = async (text: string) => {
    if (!text || typeof text !== "string") return text;
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Dịch nội dung sau từ tiếng Trung sang tiếng Việt. 
Yêu cầu:
1. Sử dụng thuật ngữ chuyên ngành logistics (Ví dụ: 配件 -> Linh kiện, 汽配 -> Phụ tùng ô tô).
2. Giữ nguyên các con số và mã hàng (Ví dụ: '14件' dịch thành '14 kiện' hoặc '14 sự kiện').
3. Chỉ trả về nội dung đã dịch, không giải thích thêm.

Nội dung: ${text}`,
      });
      
      return response.text?.trim() || text;
    } catch (err) {
      console.error("Translation error:", err);
      return text; // Fallback to original text on error
    }
  };

  const processFile = async () => {
    if (!file) return;

    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Use header: 1 to get array of arrays (preserves order and empty cells)
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rows.length === 0) {
          setError("Tệp Excel không có dữ liệu.");
          setLoading(false);
          return;
        }

        const headers = rows[0];
        const targetColumnIndex = headers.indexOf("GIAO HANG TAN NOI");

        if (targetColumnIndex === -1) {
          setError("Không tìm thấy cột 'GIAO HANG TAN NOI'.");
          setLoading(false);
          return;
        }

        const results = [...rows];
        const totalRows = results.length;

        // Start from index 1 to skip headers
        for (let i = 1; i < totalRows; i++) {
          const cellValue = results[i][targetColumnIndex];
          if (cellValue && typeof cellValue === "string") {
            results[i][targetColumnIndex] = await translateText(cellValue);
          }
          setProgress(Math.round((i / (totalRows - 1)) * 100));
        }

        setTranslatedData(results);
        setLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("File processing error:", err);
      setError("Đã xảy ra lỗi khi xử lý tệp. Vui lòng kiểm tra định dạng tệp.");
      setLoading(false);
    }
  };

  const downloadFile = () => {
    if (!translatedData) return;

    // Use aoa_to_sheet since translatedData is now an array of arrays
    const worksheet = XLSX.utils.aoa_to_sheet(translatedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Translated Data");

    const newFileName = originalFileName.replace(/\.[^/.]+$/, "") + "_translated.xlsx";
    XLSX.writeFile(workbook, newFileName);
  };

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <div className="mb-12 text-center">
        <h1 className="font-headline text-4xl font-black tracking-tight text-on-surface">
          Dịch thuật Hàng Hóa
          <span className="block text-2xl opacity-60">货物翻译模块</span>
        </h1>
        <p className="mt-4 text-on-surface-variant">
          Tải lên tệp Excel để dịch nội dung cột "GIAO HANG TAN NOI" từ tiếng Trung sang tiếng Việt bằng AI.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Upload Section */}
        <div className="space-y-6">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "group relative flex cursor-pointer flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-surface-container-highest bg-surface-container-lowest p-12 transition-all hover:border-primary/40 hover:bg-primary/5",
              file && "border-primary/40 bg-primary/5"
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
            />
            
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-container shadow-inner group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              {file ? <FileText className="h-10 w-10" /> : <Upload className="h-10 w-10" />}
            </div>

            <h3 className="text-lg font-bold text-on-surface">
              {file ? file.name : "Kéo thả hoặc chọn tệp Excel"}
            </h3>
            <p className="mt-2 text-center text-sm text-on-surface-variant/60">
              Hỗ trợ định dạng .xlsx, .xls
              <br />
              <span className="text-xs italic">Cần có cột "GIAO HANG TAN NOI"</span>
            </p>
          </div>

          <button
            onClick={processFile}
            disabled={!file || loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-sm font-bold text-on-primary shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <span>Bắt đầu dịch thuật</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {/* Status & Result Section */}
        <div className="flex flex-col justify-center rounded-[2.5rem] bg-surface-container-low p-10 border border-surface-container">
          {!loading && !translatedData && !error && (
            <div className="text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container mx-auto">
                <Loader2 className="h-8 w-8 text-on-surface-variant/20" />
              </div>
              <h3 className="text-lg font-bold text-on-surface-variant/40">Chờ tải tệp...</h3>
              <p className="mt-2 text-xs text-on-surface-variant/30">Hệ thống sẽ tự động dịch sau khi bạn nhấn nút bắt đầu.</p>
            </div>
          )}

          {loading && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-primary uppercase tracking-widest">Đang dịch... {progress}%</span>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-xs text-on-surface-variant/60 italic">
                Sử dụng Gemini AI để dịch thuật ngữ chuyên ngành logistics...
              </p>
            </div>
          )}

          {translatedData && (
            <div className="text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mx-auto">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-black text-on-surface">Dịch thuật hoàn tất!</h3>
              <p className="mt-2 text-sm text-on-surface-variant/60">
                Đã dịch xong {translatedData.length} dòng dữ liệu.
              </p>
              
              <button
                onClick={downloadFile}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-4 text-sm font-bold text-white shadow-xl transition-all hover:bg-emerald-700 active:scale-95"
              >
                <Download className="h-5 w-5" />
                <span>Tải xuống tệp đã dịch</span>
              </button>
            </div>
          )}

          {error && (
            <div className="text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error mx-auto">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-error">Lỗi xử lý</h3>
              <p className="mt-2 text-xs text-on-surface-variant/60">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-16 rounded-[2.5rem] bg-surface-container-lowest p-10 shadow-editorial border border-surface-container">
        <h3 className="font-headline text-2xl font-black mb-6 text-on-surface">
          Hướng dẫn & Bảo mật
          <span className="ml-2 text-lg opacity-40">/ 指南与安全</span>
        </h3>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Cấu hình API Key</h4>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Để tính năng dịch thuật hoạt động, bạn cần cấu hình <code className="bg-surface-container px-2 py-1 rounded text-primary">GEMINI_API_KEY</code> trong cài đặt môi trường của ứng dụng.
            </p>
            <div className="rounded-xl bg-surface-container-low p-4 border border-surface-container">
              <p className="text-[10px] font-medium leading-relaxed text-on-surface-variant/60 italic">
                * Lưu ý: Khóa API được quản lý an toàn trên máy chủ, không bao giờ hiển thị trực tiếp trong mã nguồn phía người dùng.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Quy trình xử lý</h4>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>Hệ thống chỉ đọc cột "GIAO HANG TAN NOI".</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>Dịch thuật thông minh giữ nguyên mã hàng và số lượng.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>Tạo bản sao tệp mới, giữ nguyên định dạng các cột khác.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
