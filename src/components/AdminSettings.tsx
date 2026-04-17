import React, { useState, useEffect } from "react";
import { Save, RefreshCw, AlertCircle, CheckCircle2, Scale, Boxes, MapPin, Package } from "lucide-react";
import { cn } from "../lib/utils";
import { getShippingSettings, updateShippingSettings, ShippingSettings, PRODUCT_CATEGORIES, RateEntry } from "../services/settingsService";
import { motion } from "framer-motion";

export default function AdminSettings() {
  const [settings, setSettings] = useState<ShippingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const s = await getShippingSettings();
      setSettings(s);
    } catch (err) {
      setMessage({ type: "error", text: "Lỗi khi tải cài đặt." });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateShippingSettings(settings);
      setMessage({ type: "success", text: "Cập nhật bảng giá thành công!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: "error", text: "Lỗi khi lưu cài đặt." });
    } finally {
      setSaving(false);
    }
  };

  const updateRate = (categoryKey: string, field: keyof RateEntry, value: number) => {
    if (!settings) return;
    const currentRate = settings.rates[categoryKey] || { hn_kg: 0, hn_m3: 0, sg_kg: 0, sg_m3: 0 };
    setSettings({
      ...settings,
      rates: {
        ...settings.rates,
        [categoryKey]: {
          ...currentRate,
          [field]: value
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-3xl font-black text-on-surface">Cài đặt cước phí</h2>
          <p className="mt-1 text-sm font-bold opacity-40">Freight Settings / 运费设置</p>
          <p className="mt-2 text-sm font-medium text-on-surface-variant/60 uppercase tracking-widest">
            Thiết lập ma trận giá theo loại hàng và khu vực
            <span className="block text-[10px] opacity-60">根据货物类型和区域设置价格矩阵</span>
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="signature-gradient flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold text-on-primary shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>Lưu cài đặt / 保存设置</span>
        </button>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center gap-3 rounded-2xl p-4 text-sm font-bold",
            message.type === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-error/10 text-error"
          )}
        >
          {message.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {message.text}
        </motion.div>
      )}

      <div className="space-y-8">
        {/* Price Matrix */}
        <div className="rounded-[2.5rem] bg-surface-container-lowest p-8 shadow-editorial border border-surface-container overflow-hidden">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Scale className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black">
              Bảng giá danh mục hàng hóa
              <span className="block text-sm font-bold opacity-40">品类价格表</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  <th className="px-4 py-2 min-w-[200px]">Loại hàng / 货物类型</th>
                  <th className="px-4 py-2 text-center bg-primary/5 rounded-t-xl">Hà Nội (KG) / 河内 (公斤)</th>
                  <th className="px-4 py-2 text-center bg-primary/5">Hà Nội (M3) / 河内 (立方)</th>
                  <th className="px-4 py-2 text-center bg-secondary/5 rounded-t-xl">Sài Gòn (KG) / 西贡 (公斤)</th>
                  <th className="px-4 py-2 text-center bg-secondary/5">Sài Gòn (M3) / 西贡 (立方)</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <tr key={cat.id} className="bg-surface-container-low/50 rounded-xl group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-4 font-bold text-sm text-on-surface border-l-4 border-primary/20 group-hover:border-primary transition-colors">
                      {cat.label}
                    </td>
                    <td className="px-4 py-4 bg-primary/5">
                      <input
                        type="number"
                        value={settings.rates[cat.id]?.hn_kg || 0}
                        onChange={(e) => updateRate(cat.id, 'hn_kg', parseInt(e.target.value) || 0)}
                        className="w-full rounded-xl border-none bg-surface-container-low p-3 text-sm font-bold focus:ring-2 focus:ring-primary text-center"
                      />
                    </td>
                    <td className="px-4 py-4 bg-primary/5">
                      <input
                        type="number"
                        value={settings.rates[cat.id]?.hn_m3 || 0}
                        onChange={(e) => updateRate(cat.id, 'hn_m3', parseInt(e.target.value) || 0)}
                        className="w-full rounded-xl border-none bg-surface-container-low p-3 text-sm font-bold focus:ring-2 focus:ring-primary text-center"
                      />
                    </td>
                    <td className="px-4 py-4 bg-secondary/5">
                      <input
                        type="number"
                        value={settings.rates[cat.id]?.sg_kg || 0}
                        onChange={(e) => updateRate(cat.id, 'sg_kg', parseInt(e.target.value) || 0)}
                        className="w-full rounded-xl border-none bg-surface-container-low p-3 text-sm font-bold focus:ring-2 focus:ring-secondary text-center"
                      />
                    </td>
                    <td className="px-4 py-4 bg-secondary/5">
                      <input
                        type="number"
                        value={settings.rates[cat.id]?.sg_m3 || 0}
                        onChange={(e) => updateRate(cat.id, 'sg_m3', parseInt(e.target.value) || 0)}
                        className="w-full rounded-xl border-none bg-surface-container-low p-3 text-sm font-bold focus:ring-2 focus:ring-secondary text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Global Settings */}
        <div className="rounded-[2.5rem] bg-on-background p-8 text-white shadow-editorial">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-3 text-primary">
              <RefreshCw className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black">
              Cấu hình chung
              <span className="block text-sm font-bold opacity-40">通用配置</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Hệ số quy đổi (VOL FACTOR - 1m3 = ? kg) / 换算系数
                </label>
                <input
                  type="number"
                  value={settings.volume_factor}
                  onChange={(e) => setSettings({
                    ...settings,
                    volume_factor: parseInt(e.target.value) || 0
                  })}
                  className="w-full rounded-2xl border-none bg-white/5 p-4 text-sm font-medium focus:ring-2 focus:ring-primary text-white"
                />
              </div>
              <p className="text-[10px] font-medium leading-relaxed text-white/30 italic">
                * Mặc định là 300. Hệ số này dùng để so sánh giữa cân nặng thực tế và thể tích để quyết định phương thức tính phí.
                <br />
                * 默认为 300。此系数用于比较实际重量和体积，以决定计费方式。
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-6 border border-white/10">
              <AlertCircle className="h-8 w-8 shrink-0 text-primary" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-white">Lưu ý quan trọng / 重要提示</h4>
                <p className="mt-1 text-[10px] font-medium leading-relaxed text-white/40">
                  Việc thay đổi bảng giá sẽ ảnh hưởng đến tất cả các đơn hàng mới được tạo hoặc tính toán sau thời điểm lưu. Các đơn hàng cũ đã lưu giá sẽ không bị ảnh hưởng.
                  <br />
                  修改价格表将影响保存后创建或计算的所有新订单。已保存价格的旧订单不受影响。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
