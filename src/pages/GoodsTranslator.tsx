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

  const translateBatch = async (texts: string[], retries = 3): Promise<string[]> => {
    if (!texts.length) return texts;
    
    // Clean and check what needs translation (avoid translating things that look already translated if possible, 
    // but here we must translate all per user request)
    const needsTranslation = texts.map(t => {
      const trimmed = t.trim();
      return trimmed.length > 0;
    });
    const batchToTranslate = texts.filter((_, i) => needsTranslation[i]);
    
    if (batchToTranslate.length === 0) return texts;

    addLog(`Đang gửi ${batchToTranslate.length} mục hàng lên AI...`);

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const ai = await getAI();
        const prompt = `Bạn là chuyên gia dịch thuật Logistics Trung - Việt cấp cao. 
Nhiệm vụ: Dịch danh sách tên hàng hóa trong ngành vận chuyển từ tiếng Trung sang tiếng Việt.

QUY TẮC BẮT BUỘC:
1. DỊCH 100% CÁC MÓN HÀNG: Một ô có thể có nhiều loại hàng (ngăn cách bởi dấu phẩy, dấu cộng, dấu gạch chéo, hoặc xuống dòng). Bạn PHẢI dịch TẤT CẢ, không được bỏ sót món nào. 
   - Ví dụ: "配件, 衣服" -> "Linh kiện, Quần áo"
   - Ví dụ: "配件30个+配件10个" -> "Linh kiện 30 cái + Linh kiện 10 cái"
2. ĐỐI VỚI CỘT "GIAO HÀNG TẬN NƠI" (DELIVERY): Nếu ô có ghi địa chỉ hoặc ghi chú giao hàng, hãy dịch sát nghĩa. Nếu là tên hàng hóa thì dịch theo quy tắc hàng hóa.
3. KHÔNG TÓM TẮT: Tuyệt đối không được gộp các món hàng. Ví dụ "Áo, quần, mũ" phải dịch đủ 3 món, không được dịch thành "Quần áo".
4. ĐƠN VỊ LOGISTICS: 
   - "件" (Jiàn) -> "kiện"
   - "个" (Gè) -> "cái"
   - "台" (Tái) -> "máy/bộ"
   - "套" (Tào) -> "bộ"
   - "双" (Shuāng) -> "đôi"
   - "箱" (Xiāng) -> "thùng"
5. GIỮ NGUYÊN SỐ & CHỮ TIẾNG ANH: Giữ nguyên các con số, đơn vị quốc tế (KG, m3, $, VNĐ), và các mã hàng tiếng Anh (như HS code, Model).
6. ĐỊNH DẠNG: Trả về một MẢNG JSON (JSON Array) gồm ĐÚNG ${batchToTranslate.length} chuỗi tiếng Việt theo thứ tự.
7. CHỈ TRẢ VỀ JSON: Không giải thích gì thêm.

Dữ liệu nguồn cần dịch: ${JSON.stringify(batchToTranslate)}`;

        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: prompt,
          config: {
            temperature: 0,
            responseMimeType: "application/json",
          }
        });
        
        const resultText = response.text?.trim() || "[]";
        let translatedBatch: string[] = [];
        
        try {
          // Cleanup markdown blocks if present
          const jsonMatch = resultText.match(/```json\s*([\s\S]*?)\s*```/) || 
                           resultText.match(/```\s*([\s\S]*?)\s*```/) ||
                           [null, resultText];
          const cleanJson = (jsonMatch[1] || resultText).trim();
          
          translatedBatch = JSON.parse(cleanJson);
          if (!Array.isArray(translatedBatch)) {
             // Try to find array in object
             const firstArray = Object.values(translatedBatch).find(v => Array.isArray(v));
             if (Array.isArray(firstArray)) translatedBatch = firstArray as string[];
          }
        } catch (e) {
          addLog("Lỗi phân tích JSON, đang thử trích xuất chuỗi...");
          const matches = resultText.match(/"([^"]+)"/g);
          if (matches && matches.length >= batchToTranslate.length) {
            translatedBatch = matches.map(m => m.replace(/"/g, ''));
          } else {
             // Second attempt: split by commas if it looks like a flat list
             const possibleList = resultText.replace(/[\[\]]/g, '').split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
             if (possibleList.length >= batchToTranslate.length) {
                translatedBatch = possibleList.map(s => s.trim().replace(/^"|"$/g, ''));
             }
          }
        }
        
        if (Array.isArray(translatedBatch) && translatedBatch.length >= batchToTranslate.length) {
          let transIdx = 0;
          return texts.map((original, i) => {
            if (needsTranslation[i]) {
              return translatedBatch[transIdx++] || original;
            }
            return original;
          });
        }
        
        addLog(`Kết quả AI không khớp số lượng mục. Thử lại (${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, 2000));
      } catch (err: any) {
        addLog(`Lỗi AI: ${err.message || "Không xác định"}. Thử lại...`);
        // If it's a rate limit error, wait longer
        const waitTime = err.message?.includes("429") ? 5000 : 2000;
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
    
    return texts;
  };

  const processFile = async () => {
    if (!file) return;

    try {
      addLog("Đang kiểm tra kết cấu hệ thống...");
      await getAI();
    } catch (err: any) {
      setError(err.message);
      return;
    }

    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      addLog("Bắt đầu đọc file Excel...");
      const reader = new FileReader();
      
      reader.onerror = () => {
        setError("Lỗi khi đọc tệp tin. Vui lòng thử lại.");
        setLoading(false);
      };

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          
          let targetSheetName = workbook.SheetNames[0];
          let targetColumnIndex = -1;
          let headerRowIndex = 0;
          let rows: any[][] = [];

          // Potential logistics headers to search for
          // We split them into priority groups
          const priorityHeaders = [
            "GIAO HANG TAN NOI", 
            "GIAO HÀNG TẬN NƠI",
            "GIAO TAN NOI",
            "GIAO TẬN NƠI",
            "NOI NHAN",
            "NƠI NHẬN",
            "DIA CHI",
            "ĐỊA CHỈ",
            "ADDRESS",
            "DELIVERY"
          ].map(p => p.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());

          const secondaryHeaders = [
            "TÊN HÀNG",
            "TEN HANG",
            "MẶT HÀNG",
            "MAT HANG",
            "品名",
            "货物名称"
          ].map(p => p.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());

          // Scan all sheets to find the best one
          addLog(`Tìm thấy ${workbook.SheetNames.length} sheet. Đang quét dữ liệu...`);
          
          // Phase 1: Try to find priority headers
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as any[][];
            if (sheetRows.length === 0) continue;

            for (let r = 0; r < Math.min(sheetRows.length, 40); r++) {
              const row = sheetRows[r];
              if (!Array.isArray(row)) continue;
              for (let c = 0; c < row.length; c++) {
                const rawVal = String(row[c] || "");
                const val = rawVal.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                if (priorityHeaders.some(p => val === p || val.includes(p))) {
                  targetSheetName = sheetName;
                  targetColumnIndex = c;
                  headerRowIndex = r;
                  rows = sheetRows;
                  break;
                }
              }
              if (targetColumnIndex !== -1) break;
            }
            if (targetColumnIndex !== -1) break;
          }

          // Phase 2: If no priority header, try secondary headers
          if (targetColumnIndex === -1) {
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as any[][];
              if (sheetRows.length === 0) continue;

              for (let r = 0; r < Math.min(sheetRows.length, 40); r++) {
                const row = sheetRows[r];
                if (!Array.isArray(row)) continue;
                for (let c = 0; c < row.length; c++) {
                  const rawVal = String(row[c] || "");
                  const val = rawVal.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                  if (secondaryHeaders.some(p => val === p || val.includes(p))) {
                    targetSheetName = sheetName;
                    targetColumnIndex = c;
                    headerRowIndex = r;
                    rows = sheetRows;
                    break;
                  }
                }
                if (targetColumnIndex !== -1) break;
              }
              if (targetColumnIndex !== -1) break;
            }
          }

          // Deep copy rows and filter objects to arrays if needed
          let results: any[][] = rows.map(r => Array.isArray(r) ? [...r] : []);

          if (results.length === 0 || targetColumnIndex === -1) {
            addLog("Không tìm thấy tên cột khớp. Đang dò tìm tự động...");
            
            // Re-read first sheet if no rows selected yet
            if (results.length === 0) {
              const fallbackSheet = workbook.Sheets[workbook.SheetNames[0]];
              const fallbackRows = XLSX.utils.sheet_to_json(fallbackSheet, { header: 1, defval: "", raw: false }) as any[][];
              results = fallbackRows.map(r => Array.isArray(r) ? [...r] : []);
            }
            
            if (results.length > 0) {
              const sampleRows = Math.min(results.length, 50);
              const numCols = Math.max(...results.slice(0, sampleRows).map(r => r.length));
              let maxScore = 0;
              
              for (let c = 0; c < numCols; c++) {
                let score = 0;
                for (let r = 0; r < sampleRows; r++) {
                  const text = String(results[r][c] || "");
                  // Score based on Chinese characters density
                  if (/[\u4E00-\u9FFF]/.test(text)) score += 5;
                  if (text.length > 2) score += 1;
                }
                if (score > maxScore) {
                  maxScore = score;
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
          const logMsg = `Đã chọn: "${detectedHeader}" (Cột ${targetColumnIndex + 1}) trong sheet "${targetSheetName}"`;
          setDebugInfo(logMsg);
          addLog(logMsg);

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
          
          if (totalToTranslate === 0) {
            setError("Tệp không có dữ liệu cần dịch trong cột đã chọn.");
            setLoading(false);
            return;
          }

          addLog(`Tìm thấy ${totalToTranslate} dòng cần dịch.`);
          const batchSize = 4; // Further reduced batch size for strict mobile token limits

          // Start translation from row AFTER header row
          for (let i = headerRowIndex + 1; i < totalRows; i += batchSize) {
            const end = Math.min(i + batchSize, totalRows);
            const currentProgress = Math.round(((i - headerRowIndex) / totalToTranslate) * 100);
            setProgress(currentProgress > 100 ? 100 : currentProgress);
            
            const currentChunkItems = results.slice(i, end).filter(r => String(r[targetColumnIndex] || "").trim().length > 0).length;
            if (currentChunkItems === 0) continue;

            addLog(`Đang dịch dòng ${i} đến ${end - 1} (${currentChunkItems} mục)...`);
            
            const currentBatchRows = results.slice(i, end);
            const currentBatchTexts = currentBatchRows.map(r => String(r[targetColumnIndex] || ""));
            
            try {
              const translatedBatch = await translateBatch(currentBatchTexts);
              
              for (let j = 0; j < translatedBatch.length; j++) {
                const rowIndex = i + j;
                if (rowIndex < totalRows) {
                  const original = String(results[rowIndex][targetColumnIndex] || "");
                  const translated = translatedBatch[j];
                  
                  if (translated && translated.trim() !== "" && translated !== original) {
                    successfulTranslations++;
                    results[rowIndex][targetColumnIndex] = translated;
                  }
                }
              }
            } catch (batchErr) {
              console.error("Batch failed", batchErr);
              addLog("Một nhóm hàng bị lỗi, đang tiếp tục nhóm sau...");
            }
            
            // Wait between batches to prevent rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          setProgress(100);
          if (successfulTranslations === 0) {
            addLog("Không có mục nào được dịch.");
            setError("AI không phản hồi nội dung dịch. Vui lòng kiểm tra lại cột dữ liệu hoặc thử với file nhỏ hơn.");
          } else {
            addLog(`Hoàn tất! Đã dịch ${successfulTranslations}/${totalToTranslate} mục.`);
          }

          setTranslatedData(results);
          setIsCompleted(true);
          setLoading(false);
        } catch (innerErr: any) {
          console.error("XSLX Error:", innerErr);
          setError(`Lỗi phân tích file: ${innerErr.message || "Định dạng không hỗ trợ"}`);
          setLoading(false);
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error("File processing error:", err);
      setError(`Lỗi hệ thống: ${err.message || "Không thể xử lý tệp"}`);
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
      // Especially the column we translated
      for (let i = 0; i < data.length; i++) {
        const width = getVisualWidth(data[i][colIndex]);
        if (width > maxWidth) {
          maxWidth = width;
        }
      }
      
      // For mobile readability, we need columns to be wide enough but not infinite
      // The translated column often gets very long
      const finalWidth = Math.min(Math.ceil(maxWidth * 1.35 + 5), 150);
      return { wch: finalWidth };
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
