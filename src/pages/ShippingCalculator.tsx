import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Calculator, MapPin, Scale, Boxes, AlertCircle, ChevronRight, Tag, ArrowLeft } from "lucide-react";
import { cn } from "../lib/utils";
import { getShippingSettings, calculateShippingFee, ShippingSettings, PRODUCT_CATEGORIES } from "../services/settingsService";
import { motion, AnimatePresence } from "framer-motion";

export default function ShippingCalculator() {
  const [weight, setWeight] = useState<string>("");
  const [volume, setVolume] = useState<string>("");
  const [category, setCategory] = useState<string>(PRODUCT_CATEGORIES[0].id);
  const [destination, setDestination] = useState<string>("Hà Nội");
  const [settings, setSettings] = useState<ShippingSettings | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const s = await getShippingSettings();
      setSettings(s);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleCalculate = () => {
    if (!settings || !weight || !volume) return;
    
    const w = parseFloat(weight);
    const v = parseFloat(volume);
    
    if (isNaN(w) || isNaN(v)) return;

    const res = calculateShippingFee(w, v, category, settings, destination);
    setResult(res);
  };

  return (
    <div className="min-h-screen bg-surface py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link 
          to="/" 
          className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-all hover:-translate-x-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại trang chủ</span>
          <span className="opacity-40">/ 返回首页</span>
        </Link>

        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg">
            <Calculator className="h-8 w-8" />
          </div>
          <h1 className="font-headline text-4xl font-black text-on-surface">
            Tính giá cước dự kiến
            <span className="block text-xl opacity-60">预估运费计算</span>
          </h1>
          <p className="mt-2 text-sm font-medium text-on-surface-variant/60 uppercase tracking-widest">
            Ước tính chi phí vận chuyển nhanh chóng / 快速估算运输成本
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Input Section */}
          <div className="rounded-[2.5rem] bg-surface-container-lowest p-8 shadow-editorial border border-surface-container">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                  <Tag className="h-3 w-3" /> Loại hàng hóa / 货物类型
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border-none bg-surface-container-low p-4 text-sm font-bold focus:ring-2 focus:ring-primary transition-all appearance-none"
                >
                  {PRODUCT_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    <Scale className="h-3 w-3" /> Khối lượng (kg) / 重量
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="Ví dụ: 50"
                    className="w-full rounded-2xl border-none bg-surface-container-low p-4 text-sm font-medium focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    <Boxes className="h-3 w-3" /> Thể tích (m3) / 体积
                  </label>
                  <input
                    type="number"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    placeholder="Ví dụ: 0.2"
                    className="w-full rounded-2xl border-none bg-surface-container-low p-4 text-sm font-medium focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                  <MapPin className="h-3 w-3" /> Nơi nhận / 目的地
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { vn: "Hà Nội", cn: "河内" },
                    { vn: "Hồ Chí Minh", cn: "胡志明" }
                  ].map((loc) => (
                    <button
                      key={loc.vn}
                      onClick={() => setDestination(loc.vn)}
                      className={cn(
                        "flex flex-col items-center rounded-xl py-2 text-xs font-bold transition-all border-2",
                        destination === loc.vn
                          ? "bg-primary text-white border-primary shadow-md"
                          : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-primary/30"
                      )}
                    >
                      <span>{loc.vn}</span>
                      <span className="text-[9px] opacity-70">{loc.cn}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCalculate}
                disabled={!weight || !volume || loading}
                className="w-full signature-gradient flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-sm font-bold text-on-primary shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                <div className="flex items-center gap-2">
                  <span>Tính giá cước</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-normal opacity-80">计算运费</span>
              </button>
            </div>
          </div>

          {/* Result Section */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full rounded-[2.5rem] bg-surface-container-lowest p-8 text-on-surface shadow-editorial border border-surface-container flex flex-col justify-between"
                >
                  <div>
                    <div className="mb-8 flex items-center justify-between">
                      <span className="rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                        Kết quả dự kiến / 预估结果
                      </span>
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Loại hàng / 货物类型</p>
                          <h3 className="text-sm font-bold text-on-surface truncate">{result.category}</h3>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Tính theo / 计算方式</p>
                          <h3 className="text-sm font-bold text-primary">{result.calculationMethod}</h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">Đơn giá áp dụng / 适用单价</p>
                          <p className="text-lg font-bold text-primary">{result.appliedUnitPrice.toLocaleString()}đ</p>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">Cân nặng quy đổi / 换算重量</p>
                          <p className="text-lg font-bold">{result.convertedWeight.toFixed(2)} kg</p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-primary/10 p-6 border border-primary/20">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Tổng cước dự kiến / 预估总运费</p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-4xl font-black text-on-surface">{result.totalCost.toLocaleString()}</span>
                          <span className="text-sm font-bold text-on-surface-variant">VNĐ</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-3">
                    <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4">
                      <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-medium leading-relaxed text-on-surface-variant">
                          * Lưu ý: Đây là giá cước dự kiến dựa trên thông số bạn nhập. Giá thực tế có thể thay đổi sau khi kho hàng đo đạc và kiểm tra thực tế.
                        </p>
                        <p className="text-[9px] font-medium leading-relaxed text-on-surface-variant/60 italic">
                          * 注意：这是根据您输入的信息得出的预估运费。实际价格可能会在仓库测量和检查后发生变化。
                        </p>
                      </div>
                    </div>
                    <p className="text-center text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 italic">
                      Giá chính thức sẽ được xác nhận khi hàng về kho Việt Nam / 正式价格将在货物到达越南仓库后确认
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex h-full flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-surface-container p-12 text-center"
                >
                  <div className="mb-6 rounded-full bg-surface-container p-6">
                    <Calculator className="h-12 w-12 text-on-surface-variant/20" />
                  </div>
                  <h3 className="text-lg font-bold text-on-surface-variant/40">
                    Nhập thông số để xem kết quả
                    <span className="block text-sm opacity-60">输入参数查看结果</span>
                  </h3>
                  <p className="mt-2 text-xs font-medium text-on-surface-variant/30">
                    Hệ thống sẽ tự động so sánh cân nặng thực tế và thể tích để đưa ra mức giá tối ưu nhất.
                    <br />
                    系统将自动比较实际重量和体积，以提供最佳价格。
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <InfoCard 
            title="Quy tắc quy đổi / 换算规则" 
            desc={`1m3 chuẩn = ${settings?.volume_factor || 300}kg. Hệ thống sẽ lấy giá trị cao hơn giữa cân nặng thực và cân nặng quy đổi.`} 
            cnDesc={`标准 1m3 = ${settings?.volume_factor || 300}kg。系统将取实际重量和换算重量中的较大值。`}
          />
          <InfoCard 
            title="Phân loại hàng / 货物分类" 
            desc="Mỗi loại hàng có bảng giá riêng dựa trên tính chất hàng hóa (phổ thông, mỹ phẩm, điện tử, hàng nặng)." 
            cnDesc="每种类型的货物根据其性质（普通、化妆品、电子产品、重货）都有单独的价格表。"
          />
          <InfoCard 
            title="Giá chính thức / 正式价格" 
            desc="Giá cước cuối cùng sẽ được tính dựa trên số liệu đo đạc thực tế tại kho Hà Nội hoặc Hồ Chí Minh." 
            cnDesc="最终运费将根据河内或胡志明仓库的实际测量数据计算。"
          />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, desc, cnDesc }: { title: string; desc: string; cnDesc: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-6 border border-surface-container">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">{title}</h4>
      <div className="space-y-2">
        <p className="text-xs font-medium leading-relaxed text-on-surface-variant">{desc}</p>
        <p className="text-[10px] font-medium leading-relaxed text-on-surface-variant/60 italic">{cnDesc}</p>
      </div>
    </div>
  );
}
