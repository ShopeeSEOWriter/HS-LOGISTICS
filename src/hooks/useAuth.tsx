import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from "firebase/auth";
import { doc, getDoc, setDoc, arrayUnion } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface User {
  id: string;
  email: string;
  role?: string;
  created_at: string;
  history_tracking?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  addTrackingToHistory: (trackingCode: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch additional user data (like role) from Firestore
        const userDoc = await getDoc(doc(db, "users", firebaseUser.email!));
        const isAdminEmail = firebaseUser.email === "chichine153@gmail.com" || firebaseUser.email === "zadavn1@gmail.com";
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            role: isAdminEmail ? "admin" : userData.role,
            created_at: userData.created_at,
          });
        } else {
          // Fallback if user doc doesn't exist yet
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            role: isAdminEmail ? "admin" : "user",
            created_at: new Date().toISOString(),
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const addTrackingToHistory = async (trackingCode: string) => {
    if (!user || !user.email) return;
    try {
      const userRef = doc(db, "users", user.email);
      // Use setDoc with merge: true to create the document if it doesn't exist
      await setDoc(userRef, {
        history_tracking: arrayUnion(trackingCode),
        email: user.email,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Error adding tracking to history:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, addTrackingToHistory }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
