import { db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/errorHandler";

export interface RateEntry {
  hn_kg: number;
  hn_m3: number;
  sg_kg: number;
  sg_m3: number;
}

export interface ShippingSettings {
  rates: {
    [key: string]: RateEntry;
  };
  volume_factor: number;
  gemini_api_key?: string;
}

const SETTINGS_DOC_ID = "shipping_rates";
const CONFIG_DOC_ID = "general_config";
const COLLECTION_NAME = "system_settings";

export const PRODUCT_CATEGORIES = [
  { id: "pho_thong", label: "Hàng phổ thông / 普通货物" },
  { id: "my_pham", label: "Mỹ phẩm / Thực phẩm / 化妆品/食品" },
  { id: "dien_tu", label: "Linh kiện / Điện tử / 电子产品/零件" },
  { id: "hang_nang", label: "Hàng nặng / 重货" }
];

const DEFAULT_RATES: Record<string, RateEntry> = {
  pho_thong: { hn_kg: 18000, hn_m3: 3000000, sg_kg: 22000, sg_m3: 4000000 },
  my_pham: { hn_kg: 25000, hn_m3: 3500000, sg_kg: 30000, sg_m3: 4500000 },
  dien_tu: { hn_kg: 35000, hn_m3: 4500000, sg_kg: 40000, sg_m3: 5500000 },
  hang_nang: { hn_kg: 15000, hn_m3: 2500000, sg_kg: 18000, sg_m3: 3000000 }
};

const DEFAULT_SETTINGS: ShippingSettings = {
  rates: DEFAULT_RATES,
  volume_factor: 300
};

export const getShippingSettings = async (): Promise<ShippingSettings> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        volume_factor: data.volume_factor || 300,
        rates: { ...DEFAULT_RATES, ...(data.rates || data) } // Support both nested and flat structure for migration
      } as ShippingSettings;
    } else {
      return DEFAULT_SETTINGS;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${COLLECTION_NAME}/${SETTINGS_DOC_ID}`);
    return DEFAULT_SETTINGS;
  }
};

export const updateShippingSettings = async (settings: ShippingSettings) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
    await setDoc(docRef, settings);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${SETTINGS_DOC_ID}`);
    throw error;
  }
};

export const getGeminiApiKey = async (): Promise<string | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().gemini_api_key || null;
    }
    return null;
  } catch (error) {
    console.error("Error fetching Gemini API Key:", error);
    return null;
  }
};

export const updateGeminiApiKey = async (apiKey: string) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
    await setDoc(docRef, { gemini_api_key: apiKey }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${CONFIG_DOC_ID}`);
    throw error;
  }
};

export const calculateShippingFee = (
  weight: number, 
  volume: number, 
  categoryKey: string,
  settings?: ShippingSettings | null,
  destination: string = "Hà Nội"
) => {
  const activeSettings = settings || DEFAULT_SETTINGS;
  const isSaigon = destination.toLowerCase().includes("sài gòn") || 
                   destination.toLowerCase().includes("hồ chí minh") || 
                   destination.toLowerCase().includes("hcm") || 
                   destination.toLowerCase().includes("sg");
                   
  const rateEntry = activeSettings.rates[categoryKey] || DEFAULT_RATES[categoryKey] || DEFAULT_RATES.pho_thong;
  const conversionFactor = activeSettings.volume_factor || 300;

  // Cân nặng quy đổi = m3 * volume_factor
  const convertedWeight = volume * conversionFactor;
  
  let totalCost = 0;
  let calculationMethod = "";
  let appliedUnitPrice = 0;

  const priceKg = isSaigon ? rateEntry.sg_kg : rateEntry.hn_kg;
  const priceM3 = isSaigon ? rateEntry.sg_m3 : rateEntry.hn_m3;

  // Nếu Cân nặng thực tế > Cân nặng quy đổi: Tính tiền theo KG.
  // Nếu Cân nặng thực tế < Cân nặng quy đổi: Tính tiền theo M3.
  if (weight >= convertedWeight) {
    totalCost = weight * priceKg;
    calculationMethod = "Cân nặng thực tế (KG)";
    appliedUnitPrice = priceKg;
  } else {
    totalCost = volume * priceM3;
    calculationMethod = "Thể tích (M3)";
    appliedUnitPrice = priceM3;
  }

  const categoryLabel = PRODUCT_CATEGORIES.find(c => c.id === categoryKey)?.label || categoryKey;

  return {
    weight,
    volume,
    category: categoryLabel,
    convertedWeight,
    totalCost,
    calculationMethod,
    appliedUnitPrice,
    pricePerKg: priceKg,
    pricePerM3: priceM3
  };
};
