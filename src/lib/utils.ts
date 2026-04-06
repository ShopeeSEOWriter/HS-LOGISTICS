import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeFormatDate(date: any, formatStr: string = "dd/MM/yyyy HH:mm"): string {
  if (!date) return "N/A";
  
  let d: Date;
  if (date?.toDate && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date instanceof Date) {
    d = date;
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) {
    return "N/A";
  }

  return format(d, formatStr);
}

export function mapDestination(val: string): string {
  if (!val) return "Chưa xác định";
  const v = val.toString().toUpperCase().trim();
  
  // Hà Nội
  if (v === "HN" || v.includes("HÀ NỘI") || v.includes("HA NOI") || v.includes("HANOI") || v.includes("MIỀN BẮC")) return "Hà Nội";
  
  // Hồ Chí Minh
  if (v === "SG" || v === "HCM" || v.includes("HỒ CHÍ MINH") || v.includes("HO CHI MINH") || v.includes("SÀI GÒN") || v.includes("SAI GON") || v.includes("SAIGON") || v.includes("MIỀN NAM")) return "Hồ Chí Minh";
  
  // Hải Phòng
  if (v === "HP" || v.includes("HẢI PHÒNG") || v.includes("HAI PHONG") || v.includes("HAIPHONG")) return "Hải Phòng";
  
  // Đà Nẵng
  if (v === "ĐN" || v === "DN" || v.includes("ĐÀ NẴNG") || v.includes("DA NANG") || v.includes("DANANG") || v.includes("MIỀN TRUNG")) return "Đà Nẵng";
  
  // If it's already a full name, return it properly formatted
  if (v === "HÀ NỘI") return "Hà Nội";
  if (v === "HỒ CHÍ MINH") return "Hồ Chí Minh";
  
  return val;
}
