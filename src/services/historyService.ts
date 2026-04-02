import { db } from "../lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp,
  orderBy,
  limit,
  Timestamp
} from "firebase/firestore";

const COLLECTION_NAME = "user_tracking_history";

export const saveTrackingHistory = async (userId: string, trackingCode: string) => {
  if (!userId || !trackingCode) return;

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("user_id", "==", userId),
      where("tracking_code", "==", trackingCode),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Update existing
      const historyDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, COLLECTION_NAME, historyDoc.id), {
        last_checked_at: serverTimestamp()
      });
    } else {
      // Create new
      await addDoc(collection(db, COLLECTION_NAME), {
        user_id: userId,
        tracking_code: trackingCode,
        last_checked_at: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error saving tracking history:", error);
  }
};

export const getTrackingHistory = async (userId: string) => {
  if (!userId) return [];

  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("user_id", "==", userId),
      orderBy("last_checked_at", "desc")
    );

    const querySnapshot = await getDocs(q);
    
    // Calculate the date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoMs = thirtyDaysAgo.getTime();

    const allItems = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Lazy cleanup: find items older than 30 days and delete them
    const oldItems = allItems.filter((item: any) => {
      const lastChecked = item.last_checked_at?.toMillis?.() || 0;
      return lastChecked < thirtyDaysAgoMs;
    });

    if (oldItems.length > 0) {
      // We don't await this to avoid blocking the UI
      Promise.all(oldItems.map(item => deleteDoc(doc(db, COLLECTION_NAME, item.id))))
        .catch(err => console.error("Error during lazy cleanup:", err));
    }

    return allItems.filter((item: any) => {
      const lastChecked = item.last_checked_at?.toMillis?.() || 0;
      return lastChecked >= thirtyDaysAgoMs;
    });
  } catch (error) {
    console.error("Error getting tracking history:", error);
    // Fallback if orderBy fails due to missing index
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("user_id", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoMs = thirtyDaysAgo.getTime();

      const allItems = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Lazy cleanup in fallback too
      const oldItems = allItems.filter((item: any) => {
        const lastChecked = item.last_checked_at?.toMillis?.() || 0;
        return lastChecked < thirtyDaysAgoMs;
      });

      if (oldItems.length > 0) {
        Promise.all(oldItems.map(item => deleteDoc(doc(db, COLLECTION_NAME, item.id))))
          .catch(err => console.error("Error during lazy cleanup (fallback):", err));
      }

      return allItems
        .filter((item: any) => {
          const lastChecked = item.last_checked_at?.toMillis?.() || 0;
          return lastChecked >= thirtyDaysAgoMs;
        })
        .sort((a: any, b: any) => {
          const timeA = a.last_checked_at?.toMillis?.() || 0;
          const timeB = b.last_checked_at?.toMillis?.() || 0;
          return timeB - timeA;
        });
    } catch (innerError) {
      console.error("Fallback error getting tracking history:", innerError);
      return [];
    }
  }
};
