import { db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface DestinationSettings {
  price_per_kg: number;
  price_per_m3: number;
}

export interface ShippingSettings {
  hanoi: DestinationSettings;
  saigon: DestinationSettings;
  min_weight: number;
  volume_factor: number;
}

const SETTINGS_DOC_ID = "shipping";

const DEFAULT_SETTINGS: ShippingSettings = {
  hanoi: {
    price_per_kg: 25000,
    price_per_m3: 3500000
  },
  saigon: {
    price_per_kg: 30000,
    price_per_m3: 4500000
  },
  min_weight: 1,
  volume_factor: 300
};

export const getShippingSettings = async (): Promise<ShippingSettings> => {
  try {
    const docRef = doc(db, "settings", SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { ...DEFAULT_SETTINGS, ...docSnap.data() } as ShippingSettings;
    } else {
      return DEFAULT_SETTINGS;
    }
  } catch (error) {
    console.error("Error getting shipping settings:", error);
    return DEFAULT_SETTINGS;
  }
};

export const updateShippingSettings = async (settings: ShippingSettings) => {
  try {
    const docRef = doc(db, "settings", SETTINGS_DOC_ID);
    await setDoc(docRef, settings);
  } catch (error) {
    console.error("Error updating shipping settings:", error);
    throw error;
  }
};

export const calculateShippingFee = (
  weight: number, 
  volume: number, 
  settings: ShippingSettings,
  destination: string = "Hà Nội"
) => {
  const isSaigon = destination.toLowerCase().includes("sài gòn") || destination.toLowerCase().includes("hồ chí minh");
  const destSettings = isSaigon ? settings.saigon : settings.hanoi;

  // Option 1: Traditional chargeable weight based on volume factor
  const volumeWeight = volume * settings.volume_factor;
  const chargeableWeight = Math.max(weight, volumeWeight, settings.min_weight);
  const costByWeight = chargeableWeight * destSettings.price_per_kg;

  // Option 2: Direct volume pricing
  const costByVolume = volume * destSettings.price_per_m3;

  // Usually logistics take the higher of the two
  const totalCost = Math.max(costByWeight, costByVolume);
  
  return {
    chargeableWeight,
    totalCost,
    pricePerKg: destSettings.price_per_kg,
    pricePerM3: destSettings.price_per_m3
  };
};
