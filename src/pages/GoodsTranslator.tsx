import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Upload, FileText, Download, Loader2, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, RefreshCw, HelpCircle, Share2 } from "lucide-react";
import * as XLSX from "xlsx";
import { GoogleGenAI } from "@google/genai";
import { cn } from "../lib/utils";
import { getGeminiApiKey } from "../services/settingsService";
import AdminSidebar from "../components/AdminSidebar";

// Lazy initialization for Gemini AI
let aiInstance: GoogleGenAI | null = null;

const getAI = async () => {
  if (!aiInstance) {
    // Try to get from settings first
    let apiKey = await getGeminiApiKey();
    
    // Fallback to process.env if not in settings
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || null;
    }

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please configure it in the application settings.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export default function GoodsTranslator() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [translatedData, setTranslatedData] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setTranslatedData(null);
    setProgress(0);
    setIsCompleted(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setOriginalFileName(selectedFile.name);
      setError(null);
      setTranslatedData(null);
      setIsCompleted(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isCompleted) return;
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setOriginalFileName(droppedFile.name);
      setError(null);
      setTranslatedData(null);
      setIsCompleted(false);
    }
  };

  const translateBatch = async (texts: string[], retries = 5): Promise<string[]> => {
    if (!texts.length) return texts;
    
    const needsTranslation = texts.map(t => /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(t));
    const batchToTranslate = texts.filter((_, i) => needsTranslation[i]);
    
    if (batchToTranslate.length === 0) return texts;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const ai = await getAI();
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Bạn là chuyên gia dịch thuật Logistics Việt - Trung. 
BẠN PHẢI DỊCH 100% TẤT CẢ TÊN HÀNG TRONG DANH SÁCH SAU SANG TIẾNG VIỆT.

QUY TẮC BẮT BUỘC:
1. Dịch TRIỆT ĐỂ toàn bộ nội dung. Nếu 1 ô có NHIỀU TÊN HÀNG, bạn phải dịch HẾT TẤT CẢ các tên hàng đó, không được tóm tắt hay lược bỏ bất kỳ món nào.
2. TUYỆT ĐỐI KHÔNG để sót chữ Hán nào (Ví dụ: 压缩机, 醒酒器 -> Máy nén, Bình thở rượu).
3. Giữ nguyên các định dạng số và đơn vị (Ví dụ: 14件=296KG -> 14 kiện=296KG).
4. Kết quả trả về PHẢI là một mảng JSON có đúng ${batchToTranslate.length} phần tử.
5. Tuyệt đối không giải thích, không thêm văn bản thừa.

Dữ liệu cần dịch:
${JSON.stringify(batchToTranslate)}`,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
          }
        });
        
        const resultText = response.text?.trim() || "[]";
        let translatedBatch: string[] = JSON.parse(resultText);
        
        // Ensure the AI returned the correct number of items
        if (translatedBatch.length === batchToTranslate.length) {
          let translationIndex = 0;
          return texts.map((original, i) => {
            if (needsTranslation[i]) {
              return translatedBatch[translationIndex++] || original;
            }
            return original;
          });
        }
        
        // If wrong length, try again
        console.warn(`Batch size mismatch on attempt ${attempt + 1}. Expected ${batchToTranslate.length}, got ${translatedBatch.length}`);
      } catch (err) {
        console.error(`Batch translation error on attempt ${attempt + 1}:`, err);
        // Wait before retry
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    return texts; // Fallback to original if all retries fail
  };

  const processFile = async () => {
    if (!file) return;

    try {
      await getAI();
    } catch (err: any) {
      setError(err.message);
      return;
    }

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
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rows.length === 0) {
          setError("Tệp Excel không có dữ liệu.");
          setLoading(false);
          return;
        }

        // Potential logistics headers to search for
        const possibleHeaders = [
          "GIAO HANG TAN NOI", 
          "TEN HANG", 
          "TÊN HÀNG", 
          "TEN_HANG", 
          "MAT HANG", 
          "MẶT HÀNG",
          "GOODS", 
          "DESCRIPTION", 
          "NAME", 
          "品名", 
          "货物名称",
          "Giao hàng tận nơi",
          "Tên hàng"
        ].map(p => p.toUpperCase().trim());

        let targetColumnIndex = -1;
        let headerRowIndex = 0;
        
        // Scan first 10 rows to find header row effectively
        for (let r = 0; r < Math.min(rows.length, 10); r++) {
          const rowValues = rows[r].map(h => String(h || "").toUpperCase().trim());
          
          // Look for exact match first
          targetColumnIndex = rowValues.findIndex(h => possibleHeaders.includes(h));
          
          if (targetColumnIndex === -1) {
            // Look for partial match
            targetColumnIndex = rowValues.findIndex(h => 
              possibleHeaders.some(p => h !== "" && (h.includes(p) || p.includes(h)))
            );
          }

          if (targetColumnIndex !== -1) {
            headerRowIndex = r;
            break;
          }
        }

        if (targetColumnIndex === -1) {
          setError("Không tìm thấy cột 'Giao hàng tận nơi' hoặc 'Tên hàng'. Vui lòng kiểm tra lại file Excel.");
          setLoading(false);
          return;
        }

        const results = [...rows];
        const batchSize = 10; 
        const totalRows = results.length;

        // Start translation from row AFTER header row
        for (let i = headerRowIndex + 1; i < totalRows; i += batchSize) {
          const end = Math.min(i + batchSize, totalRows);
          const currentBatch = results.slice(i, end).map(r => String(r[targetColumnIndex] || ""));
          
          const translatedBatch = await translateBatch(currentBatch);
          
          for (let j = 0; j < translatedBatch.length; j++) {
            if (i + j < totalRows) {
              results[i + j][targetColumnIndex] = translatedBatch[j];
            }
          }
          
          setProgress(Math.round((end / (totalRows - 1)) * 100));
          // Wait longer between batches for mobile stability
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        setTranslatedData(results);
        setIsCompleted(true);
        setLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("File processing error:", err);
      setError("Đã xảy ra lỗi khi xử lý tệp.");
      setLoading(false);
    }
  };

  const prepareWorkbook = (data: any[][]) => {
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Function to calculate visual width (approximate)
    const getVisualWidth = (val: any) => {
      if (val === null || val === undefined) return 0;
      const str = String(val);
      let width = 0;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        // CJK characters and some symbols are wider
        if (code > 255) {
          width += 2.2; 
        } else if (str[i] === str[i].toUpperCase() && str[i] !== str[i].toLowerCase()) {
          width += 1.2; // Uppercase letters are wider
        } else {
          width += 1;
        }
      }
      return width;
    };

    const colWidths = (data[0] || []).map((_: any, colIndex: number) => {
      let maxWidth = 8; // Default minimum
      
      // Check every single row to ensure total visibility
      for (let i = 0; i < data.length; i++) {
        const width = getVisualWidth(data[i][colIndex]);
        if (width > maxWidth) {
          maxWidth = width;
        }
      }
      
      // Add padding and cap at reasonable maximum
      return { wch: Math.min(Math.ceil(maxWidth + 5), 100) };
    });
    
    worksheet["!cols"] = colWidths;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Translated");
    return workbook;
  };

  const downloadFile = () => {
    if (!translatedData) return;

    try {
      const workbook = prepareWorkbook(translatedData);
      const newFileName = originalFileName.replace(/\.[^/.]+$/, "") + "_VN.xlsx";
      
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', newFileName);
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
    } catch (err) {
      console.error("Download error:", err);
      setError("Không thể tải xuống tệp. Vui lòng thử nút 'Copy kết quả' phía dưới.");
    }
  };

  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (navigator.share && navigator.canShare) {
      setCanShare(true);
    }
  }, []);

  const shareFile = async () => {
    if (!translatedData) return;

    try {
      const workbook = prepareWorkbook(translatedData);
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const newFileName = originalFileName.replace(/\.[^/.]+$/, "") + "_VN.xlsx";
      const file = new File([blob], newFileName, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Tải xuống tệp đã dịch',
          text: 'Tải xuống tệp Excel HS Logistics',
        });
      } else {
        downloadFile();
      }
    } catch (err) {
      console.error("Share error:", err);
      downloadFile();
    }
  };

  const [copySuccess, setCopySuccess] = useState(false);

  const copyResults = () => {
    if (!translatedData) return;
    
    try {
      // Create a tab-separated string from the table data
      const tsv = translatedData.map(row => 
        row.map((cell: any) => String(cell || "").replace(/\n/g, " ")).join("\t")
      ).join("\n");
      
      navigator.clipboard.writeText(tsv).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      });
    } catch (err) {
      setError("Không thể copy. Vui lòng thử tải lại trang.");
    }
  };

  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        await getAI();
        setIsApiKeyMissing(false);
      } catch (err) {
        setIsApiKeyMissing(true);
      }
    };
    checkApiKey();
  }, []);

  return (
    <div className="flex min-h-screen bg-surface">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-12 pt-24 md:pt-12 ml-0 md:ml-64">
        <div className="mx-auto max-w-5xl">
          <Link 
            to="/admin" 
            className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-all hover:-translate-x-1"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Bảng điều khiển</span>
            <span className="opacity-40">/ 仪表盘</span>
          </Link>

          <div className="mb-12 text-center">
            <h1 className="font-headline text-4xl font-black tracking-tight text-on-surface">
              Dịch thuật Hàng Hóa
              <span className="block text-2xl opacity-60">货物翻译模块</span>
            </h1>
            <p className="mt-4 text-on-surface-variant">
              Tải lên tệp Excel để dịch nội dung cột "GIAO HANG TAN NOI" từ tiếng Trung sang tiếng Việt bằng AI.
            </p>

            {isApiKeyMissing && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-error/10 p-4 text-error border border-error/20 max-w-2xl mx-auto">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-bold text-left">
                  Thiếu GEMINI_API_KEY. Vui lòng cấu hình API Key trong cài đặt để sử dụng tính năng này.
                  <span className="block text-[10px] opacity-60 font-normal">未设置 GEMINI_API_KEY。请在设置中配置 API 密钥以 sử dụng tính năng này.</span>
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Action Section (Upload or Download) */}
            <div className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !isCompleted && fileInputRef.current?.click()}
                className={cn(
                  "group relative flex cursor-pointer flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed p-10 transition-all min-h-[400px]",
                  isCompleted 
                    ? "border-emerald-500/50 bg-emerald-50/50 cursor-default" 
                    : (file ? "border-primary/40 bg-primary/5" : "border-surface-container-highest bg-surface-container-lowest hover:border-primary/40 hover:bg-primary/5")
                )}
              >
                {!isCompleted && (
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                )}
                
                {isCompleted ? (
                  <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center text-center">
                    <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                      <Download className="h-12 w-12" />
                    </div>
                    <h3 className="text-2xl font-black text-on-surface mb-2">Đã sẵn sàng!</h3>
                    <p className="text-sm text-emerald-600 font-bold mb-8">
                      {originalFileName.replace(/\.[^/.]+$/, "")}_VN.xlsx
                    </p>
                    
                    <div className="flex flex-col w-full gap-4 max-w-sm">
                      {canShare ? (
                        <button
                          onClick={shareFile}
                          className="flex w-full items-center justify-center gap-3 rounded-full bg-emerald-600 py-5 text-lg font-black text-white shadow-xl shadow-emerald-100 transition-all hover:bg-emerald-700 active:scale-95"
                        >
                          <Share2 className="h-6 w-6" />
                          <span>CHIA SẺ / LƯU FILE</span>
                        </button>
                      ) : (
                        <button
                          onClick={downloadFile}
                          className="flex w-full items-center justify-center gap-3 rounded-full bg-emerald-600 py-5 text-lg font-black text-white shadow-xl shadow-emerald-100 transition-all hover:bg-emerald-700 active:scale-95"
                        >
                          <Download className="h-6 w-6" />
                          <span>TẢI XUỐNG NGAY</span>
                        </button>
                      )}
                      
                      {canShare && (
                        <button
                          onClick={downloadFile}
                          className="text-xs font-bold text-emerald-700/60 hover:text-emerald-700 transition-colors"
                        >
                          Hoặc thử tải xuống trực tiếp
                        </button>
                      )}
                      
                      <button
                        onClick={resetState}
                        className="mt-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        <span>Dịch tệp khác / 翻译另一个文件</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-container shadow-inner group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {file ? <FileText className="h-10 w-10 text-primary" /> : <Upload className="h-10 w-10" />}
                    </div>

                    <h3 className="text-lg font-bold text-on-surface text-center">
                      {file ? file.name : "Kéo thả hoặc chọn tệp Excel"}
                    </h3>
                    <p className="mt-2 text-center text-sm text-on-surface-variant/60">
                      Hỗ trợ định dạng .xlsx, .xls
                      <br />
                      <span className="text-xs italic">Tự động nhận diện cột Tên hàng</span>
                    </p>
                  </>
                )}
              </div>

              {!isCompleted && (
                <button
                  onClick={processFile}
                  disabled={!file || loading}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-5 text-lg font-black text-on-primary shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>Đang xử lý {progress}%...</span>
                    </>
                  ) : (
                    <>
                      <span>BẮT ĐẦU DỊCH THUẬT</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Status & Side Result Section (Hidden or mini on mobile when completed, but good for copy fallback) */}
            <div className={cn(
              "flex flex-col justify-center rounded-[2.5rem] bg-surface-container-low p-10 border border-surface-container transition-all",
              isCompleted && "md:opacity-100 opacity-60"
            )}>
              {!loading && !translatedData && !error && (
                <div className="text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container mx-auto">
                    <HelpCircle className="h-8 w-8 text-on-surface-variant/20" />
                  </div>
                  <h3 className="text-lg font-bold text-on-surface-variant/40">Chờ lệnh...</h3>
                  <p className="mt-2 text-xs text-on-surface-variant/30">Kết quả và phương thức dự phòng sẽ xuất hiện tại đây.</p>
                </div>
              )}

              {loading && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary uppercase tracking-widest">Đang tải dữ liệu... {progress}%</span>
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container-highest">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-on-surface-variant/60 italic">
                    AI đang phân tích và dịch thuật ngữ chuyên ngành...
                  </p>
                </div>
              )}

              {translatedData && (
                <div className="text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mx-auto">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h3 className="text-xl font-black text-on-surface">Kết Quả Phụ</h3>
                  <p className="mt-2 text-sm text-on-surface-variant/60 mb-8">
                    Nếu phím tải về bị chặn bởi trình duyệt web hoặc ứng dụng mạng xã hội (Zalo, WeChat, Facebook), hãy dùng phím Copy phía dưới.
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={copyResults}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-bold transition-all active:scale-95 shadow-md",
                        copySuccess 
                          ? "bg-primary text-white" 
                          : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                      )}
                    >
                      {copySuccess ? (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          <span>ĐÃ SAO CHÉP KẾT QUẢ</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-5 w-5" />
                          <span>SAO CHÉP KẾT QUẢ</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-on-surface-variant/40 italic">
                      Dán trực tiếp vào ứng dụng Excel hoặc ghi chú trên điện thoại của bạn.
                    </p>
                  </div>
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
      </main>
    </div>
  );
}
