import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Bell, Package, Check, Trash2, Clock, X } from "lucide-react";
import { cn, safeFormatDate } from "../lib/utils";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface NotificationDropdownProps {
  userId: string;
  onClose: () => void;
}

export default function NotificationDropdown({ userId, onClose }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", userId),
      orderBy("created_at", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read_status: true });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read_status).forEach(n => {
        batch.update(doc(db, "notifications", n.id), { read_status: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  return (
    <div className="absolute right-0 mt-4 w-80 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between border-b border-surface-container p-4">
        <h3 className="text-sm font-bold text-on-surface">Thông báo / 通知</h3>
        <div className="flex gap-2">
          <button 
            onClick={markAllAsRead}
            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80"
          >
            Đọc tất cả
          </button>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Bell className="mb-3 h-8 w-8 text-on-surface-variant/20" />
            <p className="text-xs font-medium text-on-surface-variant/60">Không có thông báo mới</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-container">
            {notifications.map((n) => (
              <div 
                key={n.id} 
                className={cn(
                  "relative p-4 transition-colors hover:bg-surface-container-low",
                  !n.read_status && "bg-primary/5"
                )}
              >
                <div className="flex gap-3">
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    !n.read_status ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant/40"
                  )}>
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className={cn("text-xs leading-relaxed", !n.read_status ? "font-bold text-on-surface" : "font-medium text-on-surface-variant")}>
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] text-on-surface-variant/60">
                        <Clock className="h-3 w-3" />
                        <span>{safeFormatDate(n.created_at, "dd/MM HH:mm")}</span>
                      </div>
                      {!n.read_status && (
                        <button 
                          onClick={() => markAsRead(n.id)}
                          className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                        >
                          <Check className="h-3 w-3" />
                          Đã đọc
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <Link 
                  to={`/tracking/${n.tracking_code}`} 
                  onClick={() => {
                    markAsRead(n.id);
                    onClose();
                  }}
                  className="absolute inset-0 z-0"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-surface-container p-3 text-center">
        <Link 
          to="/history" 
          onClick={onClose}
          className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary"
        >
          Xem tất cả lịch sử
        </Link>
      </div>
    </div>
  );
}
