/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import TrackingDetail from "./pages/TrackingDetail";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Support from "./pages/Support";
import AdminTrucks from "./pages/AdminTrucks";
import AdminTruckDetail from "./pages/AdminTruckDetail";
import ShippingCalculator from "./pages/ShippingCalculator";
import Auth from "./pages/Auth";
import UserHistory from "./pages/UserHistory";
import GoodsTranslator from "./pages/GoodsTranslator";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { cn } from "./lib/utils";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const isOps = location.pathname.startsWith("/ops") || location.pathname.startsWith("/admin");

  return (
    <div className={cn("flex min-h-screen flex-col", isOps ? "bg-surface" : "bg-surface")}>
      <Navbar />
      <div className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tracking/:id" element={<TrackingDetail />} />
          <Route path="/ops" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/trucks" element={<ProtectedRoute adminOnly><AdminTrucks /></ProtectedRoute>} />
          <Route path="/admin/trucks/:id" element={<ProtectedRoute adminOnly><AdminTruckDetail /></ProtectedRoute>} />
          <Route path="/calculator" element={<ShippingCalculator />} />
          <Route path="/history" element={<ProtectedRoute><UserHistory /></ProtectedRoute>} />
          <Route path="/support" element={<Support />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin/translator" element={<ProtectedRoute adminOnly><GoodsTranslator /></ProtectedRoute>} />
        </Routes>
      </div>
      {!isOps && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

