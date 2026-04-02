import { collection, query, where, getDocs, addDoc, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface NotificationData {
  user_id: string;
  tracking_code: string;
  message: string;
  read_status: boolean;
  created_at: any;
  type: "status_update" | "system";
}

export const notificationService = {
  /**
   * Creates notifications for all users tracking a specific code
   */
  async notifyStatusUpdate(trackingCode: string, newStatus: string, location: string) {
    try {
      // 1. Find all users tracking this code
      const q = query(
        collection(db, "user_tracking_history"),
        where("tracking_code", "==", trackingCode)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      const now = serverTimestamp();

      snapshot.docs.forEach((userDoc) => {
        const userData = userDoc.data();
        const notificationRef = doc(collection(db, "notifications"));
        
        batch.set(notificationRef, {
          user_id: userData.user_id,
          tracking_code: trackingCode,
          message: `Đơn hàng ${trackingCode} đã cập nhật trạng thái: ${newStatus} tại ${location}`,
          read_status: false,
          created_at: now,
          type: "status_update"
        });
      });

      await batch.commit();
      
      // 2. Trigger email (Mock for now, or via API)
      console.log(`[Notification Service] Notified ${snapshot.size} users about ${trackingCode}`);
    } catch (error) {
      console.error("Error creating notifications:", error);
    }
  },

  /**
   * Bulk notify for multiple tracking codes (e.g. truck update)
   */
  async notifyBulkStatusUpdate(trackingCodes: string[], newStatus: string, location: string) {
    // For simplicity, we'll just loop, but for large scale we'd optimize
    for (const code of trackingCodes) {
      await this.notifyStatusUpdate(code, newStatus, location);
    }
  }
};
