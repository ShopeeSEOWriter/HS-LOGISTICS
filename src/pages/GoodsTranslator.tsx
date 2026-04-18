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

  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const addLog = (msg: string) => setDebugLog(prev => [msg, ...prev].slice(0, 10));

  const resetState = () => {
    setFile(null);
    setTranslatedData(null);
    setProgress(0);
    setIsCompleted(false);
    setError(null);
    setDebugInfo(null);
    setDebugLog([]);
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
    
    // Improved strategy: Translate all non-empty strings in the target column
    // This avoids missing items that might not have triggered the CJK regex but still need translation
    const needsTranslation = texts.map(t => t.trim().length > 0);
    const batchToTranslate = texts.filter((_, i) => needsTranslation[i]);
    
    if (batchToTranslate.length === 0) return texts;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const ai = await getAI();
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Bạn là chuyên gia dịch thuật Logistics Việt - Trung cao cấp.
Nhiệm vụ: DỊCH 100% danh sách tên hàng hóa sau đây sang tiếng Việt.

QUY TẮC BẮT BUỘC:
1. DỊCH HẾT MỌI THỨ: Nếu một ô chứa NHIỀU món hàng (ngăn cách bởi dấu phẩy, dấu cộng, dấu gạch chéo, hoặc xuống dòng), bạn PHẢI dịch TẤT CẢ các món đó. Không được bỏ sót bất kỳ chữ nào.
2. KHÔNG TÓM TẮT: Ví dụ: "Áo, quần, mũ" không được dịch thành "Quần áo". Phải dịch là "Áo, quần, mũ".
3. GIỮ NGUYÊN CẤU TRÚC: Nếu ô có dạng "A+B+C" hoặc "A,B,C", kết quả dịch cũng phải là "DịchA+DịchB+DịchC" hoặc "DịchA, DịchB, DịchC".
4. GIỮ NGUYÊN SỐ LƯỢNG: Giữ nguyên các con số và đơn vị tính (Ví dụ: 14件=296KG -> 14 kiện=296KG).
5. Ô "GIAO HÀNG TẬN NƠI": Đây là cột quan trọng nhất, hãy dịch cực kỳ chi tiết từng phụ kiện, từng món hàng nhỏ nhất bên trong.
6. ĐỊNH DẠNG: Trả về một MẢNG JSON (JSON Array) có đúng ${batchToTranslate.length} phần tử.
7. CHỈ TRẢ VỀ JSON: Không giải thích gì thêm.

Dữ liệu nguồn:
${JSON.stringify(batchToTranslate)}`,
          config: {
            temperature: 0,
            responseMimeType: "application/json",
          }
        });
        
        const resultText = response.text?.trim() || "[]";
        let translatedBatch: string[] = [];
        
        try {
          const parsed = JSON.parse(resultText);
          if (Array.isArray(parsed)) {
            translatedBatch = parsed;
          } else if (typeof parsed === 'object' && parsed !== null) {
            // Find any array property (sometimes AI wraps response)
            const firstArray = Object.values(parsed).find(v => Array.isArray(v));
            if (Array.isArray(firstArray)) {
              translatedBatch = firstArray as string[];
            }
          }
        } catch (parseErr) {
          console.error("Parse error:", parseErr, "Text:", resultText);
          // Simple fallback for broken JSON: try to split by commas or newlines if it looks like a list
          if (resultText.includes("[") && resultText.includes("]")) {
            const matches = resultText.match(/"([^"]+)"/g);
            if (matches && matches.length >= batchToTranslate.length) {
              translatedBatch = matches.map(m => m.replace(/"/g, ''));
            }
          }
        }
        
        // Ensure the AI returned results
        if (translatedBatch.length >= batchToTranslate.length) {
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
      addLog("Bắt đầu đọc file...");
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        
        let targetSheetName = workbook.SheetNames[0];
        let targetColumnIndex = -1;
        let headerRowIndex = 0;
        let rows: any[][] = [];

        // Potential logistics headers to search for
        const possibleHeaders = [
          "GIAO HANG TAN NOI", 
          "GIAO HÀNG TẬN NƠI",
          "DỊCH VỤ",
          "VAN CHUYEN",
          "VẬN CHUYỂN",
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
          "Tên hàng",
          "TÊN",
          "HOA DON",
          "HÓA ĐƠN"
        ].map(p => p.toUpperCase().trim());

        // Scan all sheets to find the best one
        addLog(`Đang tìm kiếm trong ${workbook.SheetNames.length} sheet...`);
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
          if (sheetRows.length === 0) continue;

          // Scan first 15 rows of each sheet
          for (let r = 0; r < Math.min(sheetRows.length, 15); r++) {
            const row = sheetRows[r];
            if (!Array.isArray(row)) continue;
            
            const rowValues = row.map(h => String(h || "").toUpperCase().trim());
            const foundIdx = rowValues.findIndex(h => possibleHeaders.includes(h) || possibleHeaders.some(p => h !== "" && (h.includes(p) || p.includes(h))));
            
            if (foundIdx !== -1) {
              targetSheetName = sheetName;
              targetColumnIndex = foundIdx;
              headerRowIndex = r;
              rows = sheetRows;
              break;
            }
          }
          if (targetColumnIndex !== -1) break;
        }

        // Deep copy rows and filter objects to arrays if needed
        let results: any[][] = rows.map(r => Array.isArray(r) ? [...r] : []);

        if (results.length === 0 || targetColumnIndex === -1) {
          addLog("Không tìm thấy header, thử chế độ dò tìm tự động...");
          // Fallback: look for the column that contains the most Chinese characters in the first 30 rows
          let maxChineseCount = 0;
          const fallbackSheet = workbook.Sheets[workbook.SheetNames[0]];
          const fallbackRows = XLSX.utils.sheet_to_json(fallbackSheet, { header: 1, defval: "" }) as any[][];
          results = fallbackRows.map(r => Array.isArray(r) ? [...r] : []);
          
          if (results.length > 0) {
            const sampleRows = Math.min(results.length, 30);
            const numCols = Math.max(...results.slice(0, sampleRows).map(r => r.length));
            
            for (let c = 0; c < numCols; c++) {
              let chineseCount = 0;
              for (let r = 0; r < sampleRows; r++) {
                if (/[\u4E00-\u9FFF]/.test(String(results[r][c] || ""))) {
                  chineseCount++;
                }
              }
              if (chineseCount > maxChineseCount) {
                maxChineseCount = chineseCount;
                targetColumnIndex = c;
              }
            }
          }
        }

        if (results.length === 0 || targetColumnIndex === -1) {
          setError("Không tìm thấy cột 'Giao hàng tận nơi' hoặc dữ liệu hàng hóa. Vui lòng kiểm tra lại file Excel.");
          setLoading(false);
          return;
        }

        const detectedHeader = String(results[headerRowIndex]?.[targetColumnIndex] || `Cột ${targetColumnIndex + 1}`);
        setDebugInfo(`Phát hiện: "${detectedHeader}" tại Sheet: "${targetSheetName}"`);
        addLog(`Đã xác định cột: ${detectedHeader}`);

        const totalRows = results.length;
        let successfulTranslations = 0;
        let totalToTranslate = 0;

        // Count non-empty cells after header
        for (let k = headerRowIndex + 1; k < totalRows; k++) {
          const cellVal = String(results[k][targetColumnIndex] || "").trim();
          if (cellVal.length > 0) {
            totalToTranslate++;
          }
        }
        
        addLog(`Phát hiện ${totalToTranslate} ô cần dịch.`);
        const batchSize = 5;

        // Start translation from row AFTER header row
        for (let i = headerRowIndex + 1; i < totalRows; i += batchSize) {
          const end = Math.min(i + batchSize, totalRows);
          const currentBatchRows = results.slice(i, end);
          const currentBatchTexts = currentBatchRows.map(r => String(r[targetColumnIndex] || ""));
          
          try {
            const translatedBatch = await translateBatch(currentBatchTexts);
            
            for (let j = 0; j < translatedBatch.length; j++) {
              if (i + j < totalRows) {
                const original = String(results[i + j][targetColumnIndex] || "");
                const translated = translatedBatch[j];
                
                if (translated && translated !== original && translated.trim() !== "") {
                  successfulTranslations++;
                  results[i + j][targetColumnIndex] = translated;
                }
              }
            }
          } catch (batchErr) {
            console.error("Batch failed at row", i, batchErr);
            addLog(`Lỗi tại dòng ${i + 1}.`);
          }
          
          setProgress(Math.round((end / totalRows) * 100));
          // Wait longer between batches for mobile stability
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        if (totalToTranslate > 0 && successfulTranslations === 0) {
          addLog("Cảnh báo: Không có ô nào được dịch thành công.");
          setError("Ứng dụng không thể dịch được nội dung. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.");
        } else {
          addLog(`Dịch thành công ${successfulTranslations}/${totalToTranslate} ô.`);
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
      let maxWidth = 10;
      
      // Check every single row to ensure total visibility
      for (let i = 0; i < data.length; i++) {
        const width = getVisualWidth(data[i][colIndex]);
        if (width > maxWidth) {
          maxWidth = width;
        }
      }
      
      // More aggressive padding for mobile readability
      // We add a safety margin of +8 and multiplier 1.2
      return { wch: Math.min(Math.ceil(maxWidth * 1.25 + 8), 120) };
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
                  <div className="bg-surface-container rounded-xl p-4 max-h-32 overflow-y-auto">
                    {debugLog.map((log, idx) => (
                      <p key={idx} className="text-[10px] text-on-surface-variant font-mono">
                        {idx === 0 && <span className="animate-pulse mr-2">●</span>}
                        {log}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {translatedData && (
                <div className="text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mx-auto">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h3 className="text-xl font-black text-on-surface">Hoàn Tất Dịch Thuật</h3>
                  {debugInfo && <p className="text-xs text-primary mb-2 font-bold">{debugInfo}</p>}
                  <p className="mt-2 text-sm text-on-surface-variant/60 mb-8 font-medium">
                    Nếu phím tải về bị chặn bởi trình duyệt, hãy dùng phím Copy phía dưới.
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
