console.log("Loading server.ts...");
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, addDoc, serverTimestamp, query, where, getDocs, writeBatch, deleteDoc, orderBy, limit } from "firebase/firestore";
import fs from "fs";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase config
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Initialize Firebase on server
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const upload = multer({ storage: multer.memoryStorage() });
const JWT_SECRET = process.env.JWT_SECRET || "precision-logistics-secret-key";

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Request Logger
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV || "development" });
  });

  // Auth Middleware
  const authenticateToken = async (req: any, res: any, next: any) => {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
  };

  // Auth Routes
  app.post("/api/register", async (req, res) => {
    console.log("POST /api/register", req.body.email);
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });

      const userRef = doc(db, "users", email);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) return res.status(400).json({ error: "User already exists" });

      const hashedPassword = await bcrypt.hash(password, 10);
      const role = (email === "chichine153@gmail.com" || email === "zadavn1@gmail.com") ? "admin" : "user";
      const userData = {
        email,
        password_hash: hashedPassword,
        role,
        created_at: new Date().toISOString()
      };
      await setDoc(userRef, userData);

      const token = jwt.sign({ id: email, email, role }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
      res.json({ success: true, user: { id: email, email, role, created_at: userData.created_at } });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    console.log("POST /api/login", req.body.email);
    try {
      const { email, password } = req.body;
      const userRef = doc(db, "users", email);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) return res.status(400).json({ error: "Invalid credentials" });

      const userData = userSnap.data();
      const validPassword = await bcrypt.compare(password, userData.password_hash);
      if (!validPassword) return res.status(400).json({ error: "Invalid credentials" });

      // Auto-assign admin role to specific email
      let role = userData.role || "user";
      if ((email === "chichine153@gmail.com" || email === "zadavn1@gmail.com") && role !== "admin") {
        role = "admin";
        await updateDoc(userRef, { role: "admin" });
      }

      const token = jwt.sign({ id: email, email, role }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
      res.json({ success: true, user: { id: email, email, role, created_at: userData.created_at } });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/me", authenticateToken, async (req: any, res) => {
    try {
      const userRef = doc(db, "users", req.user.id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return res.status(404).json({ error: "User not found" });
      const userData = userSnap.data();
      
      // Ensure role is up to date for the admin email
      let role = userData.role || "user";
      if ((userData.email === "chichine153@gmail.com" || userData.email === "zadavn1@gmail.com") && role !== "admin") {
        role = "admin";
        await updateDoc(userRef, { role: "admin" });
      }

      res.json({ id: userSnap.id, email: userData.email, role, created_at: userData.created_at });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  // Notification Helper
  const createNotifications = async (trackingCodes: string[], status: string, location: string) => {
    try {
      for (const code of trackingCodes) {
        const historyQuery = query(
          collection(db, "user_tracking_history"),
          where("tracking_code", "==", code)
        );
        const historySnap = await getDocs(historyQuery);
        
        const batch = writeBatch(db);
        const now = new Date().toISOString();

        for (const historyDoc of historySnap.docs) {
          const userData = historyDoc.data();
          const notificationRef = doc(collection(db, "notifications"));
          const message = `Đơn hàng ${code} đã cập nhật trạng thái: ${status} tại ${location}`;
          
          batch.set(notificationRef, {
            user_id: userData.user_id,
            tracking_code: code,
            message,
            read_status: false,
            created_at: now,
            type: "status_update"
          });

          // Send Email (Mock/Log for now, or use nodemailer if configured)
          if (process.env.SMTP_HOST && userData.user_email) {
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: parseInt(process.env.SMTP_PORT || "587"),
              secure: process.env.SMTP_SECURE === "true",
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
            });

            transporter.sendMail({
              from: `"HS Logistics" <${process.env.SMTP_USER}>`,
              to: userData.user_email,
              subject: `Cập nhật vận đơn ${code}`,
              text: message,
              html: `<p>${message}</p><p><a href="https://ais-dev-lxmmkoo75qo6bljqocelpa-210931501535.asia-east1.run.app/tracking/${code}">Xem chi tiết tại đây</a></p>`,
            }).catch(e => console.error("Email send error:", e));
          } else {
            console.log(`[Email Notification] To: ${userData.user_email || userData.user_id}, Msg: ${message}`);
          }
        }
        await batch.commit();
      }
    } catch (error) {
      console.error("Notification creation error:", error);
    }
  };

  // Tracking History Routes
  app.post("/api/track", async (req: any, res) => {
    try {
      const { trackingCode } = req.body;
      const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
      
      let userId = null;
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          userId = decoded.id;
        } catch (e) {}
      }

      if (userId && trackingCode) {
        const historyQuery = query(
          collection(db, "user_tracking_history"), 
          where("user_id", "==", userId),
          where("tracking_code", "==", trackingCode)
        );
        const historySnap = await getDocs(historyQuery);
        const now = new Date().toISOString();

        if (historySnap.empty) {
          await addDoc(collection(db, "user_tracking_history"), {
            user_id: userId,
            tracking_code: trackingCode,
            last_checked_at: now
          });
        } else {
          const historyDoc = historySnap.docs[0];
          await updateDoc(doc(db, "user_tracking_history", historyDoc.id), {
            last_checked_at: now
          });
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/history", authenticateToken, async (req: any, res) => {
    try {
      const historyQuery = query(
        collection(db, "user_tracking_history"),
        where("user_id", "==", req.user.id),
        orderBy("last_checked_at", "desc")
      );
      const historySnap = await getDocs(historyQuery);
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const history = [];
      for (const historyDoc of historySnap.docs) {
        const data = historyDoc.data();
        const lastChecked = new Date(data.last_checked_at);
        
        if (lastChecked < thirtyDaysAgo) {
          // Cleanup old history
          await deleteDoc(doc(db, "user_tracking_history", historyDoc.id));
          continue;
        }

        // Fetch current status of the order
        const orderRef = doc(db, "orders", data.tracking_code);
        const orderSnap = await getDoc(orderRef);
        
        history.push({
          id: historyDoc.id,
          tracking_code: data.tracking_code,
          last_checked_at: data.last_checked_at,
          status: orderSnap.exists() ? orderSnap.data().status : "Không tìm thấy"
        });
      }

      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/history/:id", authenticateToken, async (req: any, res) => {
    try {
      const historyRef = doc(db, "user_tracking_history", req.params.id);
      const historySnap = await getDoc(historyRef);
      if (!historySnap.exists()) return res.status(404).json({ error: "Not found" });
      if (historySnap.data().user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

      await deleteDoc(historyRef);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Routes (Existing)
  app.post("/api/admin/upload-excel", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const truckCode = req.body.truckCode || "TRUCK_UNKNOWN";
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (data.length === 0) return res.status(400).json({ error: "Tệp Excel trống" });

      // Smart Column Mapping
      const firstRow = data[0];
      const allKeys = Object.keys(firstRow);

      const findKey = (patterns: string[]) => allKeys.find(key => {
        const k = key.toLowerCase().trim();
        return patterns.some(p => k.includes(p));
      });

      const trackingKey = findKey(["mã vận đơn", "tracking", "mã đơn", "bill", "mã hàng", "mã kiện"]) || allKeys[0];
      const destinationKey = findKey(["nơi đến", "địa chỉ", "destination", "tỉnh", "đến"]);
      const weightKey = findKey(["trọng lượng", "cân nặng", "weight", "kg"]);
      const volumeKey = findKey(["thể tích", "khối", "volume", "m3"]);
      const itemTypeKey = findKey(["mặt hàng", "loại hàng", "item", "tên hàng"]);

      const mapDestination = (val: string) => {
        if (!val) return "Chưa xác định";
        const v = val.toString().toUpperCase().trim();
        if (v === "HN" || v.includes("HÀ NỘI") || v.includes("HA NOI") || v.includes("HANOI")) return "Hà Nội";
        if (v === "SG" || v === "HCM" || v.includes("HỒ CHÍ MINH") || v.includes("HO CHI MINH") || v.includes("SÀI GÒN") || v.includes("SAI GON") || v.includes("SAIGON")) return "Hồ Chí Minh";
        if (v === "HP" || v.includes("HẢI PHÒNG") || v.includes("HAI PHONG") || v.includes("HAIPHONG")) return "Hải Phòng";
        if (v === "ĐN" || v.includes("ĐÀ NẴNG") || v.includes("DA NANG") || v.includes("DANANG")) return "Đà Nẵng";
        return val;
      };

      const ordersToProcess: any[] = [];
      
      for (const row of data) {
        const trackingCode = row[trackingKey]?.toString().trim();
        if (!trackingCode || trackingCode === "MÃ HÀNG" || trackingCode === "Mã hàng") continue;

        const rawDest = destinationKey ? row[destinationKey]?.toString().trim() : null;
        const weight = weightKey ? row[weightKey]?.toString().trim() : "0";
        const volume = volumeKey ? row[volumeKey]?.toString().trim() : "0";
        const itemType = itemTypeKey ? row[itemTypeKey]?.toString().trim() : "Hàng hóa";

        ordersToProcess.push({
          trackingCode,
          destination: mapDestination(rawDest || ""),
          volume: volume || "0",
          weight: weight || "0",
          itemType: itemType || "Hàng hóa"
        });
      }

      const now = new Date().toISOString();
      const truckRef = doc(db, "trucks", truckCode);
      const truckSnap = await getDoc(truckRef);
      
      const mainDestination = ordersToProcess.length > 0 ? ordersToProcess[0].destination : "Chưa xác định";

      if (!truckSnap.exists()) {
        await setDoc(truckRef, {
          truck_code: truckCode,
          status: "Đã bốc hàng",
          last_updated: now,
          order_count: ordersToProcess.length,
          destination: mainDestination
        });
      } else {
        await updateDoc(truckRef, {
          last_updated: now,
          order_count: ordersToProcess.length,
          status: "Đã bốc hàng",
          destination: mainDestination
        });
      }

      const batch = writeBatch(db);
      for (const order of ordersToProcess) {
        const orderRef = doc(db, "orders", order.trackingCode);
        
        const orderData = {
          tracking_code: order.trackingCode,
          truck_code: truckCode,
          status: "Đã bốc hàng",
          destination: order.destination,
          volume: order.volume,
          weight: order.weight,
          item_type: order.itemType,
          last_updated: now
        };

        // Use set with merge: true to avoid getDoc inside loop
        batch.set(orderRef, orderData, { merge: true });

        // Use deterministic ID to prevent duplicate logs for the same status
        const logId = `log_${order.trackingCode}_${order.status.replace(/\s+/g, '_')}`;
        const logRef = doc(db, "tracking_logs", logId);
        batch.set(logRef, {
          tracking_code: order.trackingCode,
          status: "Đã bốc hàng",
          timestamp: now,
          location: "Đông Hưng",
          note: `Hàng đã được bốc lên xe ${truckCode}. Điểm đến: ${order.destination}`
        });
      }

      // Also create a log for the truck itself
      const truckLogId = `log_${truckCode}_Đã_bốc_hàng`;
      const truckLogRef = doc(db, "tracking_logs", truckLogId);
      batch.set(truckLogRef, {
        tracking_code: truckCode,
        status: "Đã bốc hàng",
        timestamp: now,
        location: "Đông Hưng",
        note: `Xe ${truckCode} đã bốc xong hàng và chuẩn bị khởi hành.`
      });

      await batch.commit();

      // Notify users
      createNotifications(ordersToProcess.map(o => o.trackingCode), "Đã bốc hàng", "Đông Hưng");

      res.json({ success: true, results: { truckCode, count: ordersToProcess.length } });
    } catch (error: any) {
      console.error("Excel upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/bulk-update-status", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Chưa tải lên tệp Excel" });
      const { status, location, note } = req.body;

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (data.length === 0) return res.status(400).json({ error: "Tệp Excel trống" });

      // Smart Column Mapping: Tìm cột chứa mã vận đơn
      const firstRow = data[0];
      const allKeys = Object.keys(firstRow);
      
      let trackingKey = allKeys.find(key => {
        const k = key.toLowerCase().trim();
        return k.includes("mã vận đơn") || 
               k.includes("tracking") || 
               k.includes("mã đơn") || 
               k.includes("bill") || 
               k.includes("mã hàng") || 
               k.includes("mã kiện");
      });

      // Tìm cột Nơi đến
      const destinationKey = allKeys.find(key => {
        const k = key.toLowerCase().trim();
        return k.includes("nơi đến") || k.includes("địa chỉ") || k.includes("destination") || k.includes("tỉnh");
      });

      // Fallback: Nếu không tìm thấy tiêu đề khớp, lấy cột đầu tiên
      if (!trackingKey && allKeys.length > 0) {
        trackingKey = allKeys[0];
      }

      if (!trackingKey) {
        return res.status(400).json({ error: "Không tìm thấy dữ liệu trong file Excel." });
      }

      const mapDestination = (val: string) => {
        if (!val) return "Chưa xác định";
        const v = val.toString().toUpperCase().trim();
        if (v === "HN" || v.includes("HÀ NỘI") || v.includes("HA NOI") || v.includes("HANOI")) return "Hà Nội";
        if (v === "SG" || v === "HCM" || v.includes("HỒ CHÍ MINH") || v.includes("HO CHI MINH") || v.includes("SÀI GÒN") || v.includes("SAI GON") || v.includes("SAIGON")) return "Hồ Chí Minh";
        if (v === "HP" || v.includes("HẢI PHÒNG") || v.includes("HAI PHONG") || v.includes("HAIPHONG")) return "Hải Phòng";
        if (v === "ĐN" || v.includes("ĐÀ NẴNG") || v.includes("DA NANG") || v.includes("DANANG")) return "Đà Nẵng";
        return val;
      };

      const now = new Date().toISOString();
      const batch = writeBatch(db);
      const processedCodes = new Set<string>();

      for (const row of data) {
        const code = row[trackingKey]?.toString().trim();
        if (!code || processedCodes.has(code)) continue;
        processedCodes.add(code);

        const rawDest = destinationKey ? row[destinationKey]?.toString().trim() : null;
        const destination = rawDest ? mapDestination(rawDest) : null;

        const orderRef = doc(db, "orders", code);
        const orderSnap = await getDoc(orderRef);

        const updateData: any = {
          status,
          last_updated: now,
        };

        if (destination) {
          updateData.destination = destination;
        }

        // Nếu là tạo mới (Auto-create), bổ sung các trường mặc định
        if (!orderSnap.exists()) {
          updateData.tracking_code = code;
          updateData.truck_code = "N/A";
          if (!updateData.destination) updateData.destination = "Chưa xác định";
          updateData.weight = "0";
          updateData.volume = "0";
          updateData.item_type = "Hàng hóa (Tự động tạo)";
          updateData.created_at = now;
          batch.set(orderRef, updateData);
        } else {
          batch.update(orderRef, updateData);
        }

        // Thêm log hành trình với ID xác định để tránh trùng lặp
        const logId = `log_${code}_${status.replace(/\s+/g, '_')}`;
        const logRef = doc(db, "tracking_logs", logId);
        batch.set(logRef, {
          tracking_code: code,
          status,
          timestamp: now,
          location: location || "N/A",
          note: note || `Cập nhật trạng thái hàng loạt: ${status}`
        });
      }

      await batch.commit();
      
      // Notify users
      createNotifications(Array.from(processedCodes), status, location || "N/A");

      res.json({ success: true, count: processedCodes.size });
    } catch (error: any) {
      console.error("Bulk update error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/admin/update-truck-status", async (req, res) => {
    try {
      const { truckCode, status, location, note } = req.body;
      if (!truckCode || !status) {
        return res.status(400).json({ error: "Missing truckCode or status" });
      }

      const now = new Date().toISOString();
      const truckRef = doc(db, "trucks", truckCode);
      
      // Update Truck
      await updateDoc(truckRef, {
        status,
        last_updated: now
      });

      const batch = writeBatch(db);

      // Add log for the truck itself with deterministic ID
      const truckLogId = `log_${truckCode}_${status.replace(/\s+/g, '_')}`;
      const truckLogRef = doc(db, "tracking_logs", truckLogId);
      batch.set(truckLogRef, {
        tracking_code: truckCode,
        status,
        timestamp: now,
        location: location || "N/A",
        note: note || `Cập nhật trạng thái xe ${truckCode}: ${status}`
      });

      // Update all orders in this truck
      const ordersQuery = query(collection(db, "orders"), where("truck_code", "==", truckCode));
      const ordersSnap = await getDocs(ordersQuery);
      
      ordersSnap.forEach((orderDoc) => {
        const orderRef = doc(db, "orders", orderDoc.id);
        batch.update(orderRef, {
          status,
          last_updated: now
        });

        // Add log with deterministic ID
        const logId = `log_${orderDoc.id}_${status.replace(/\s+/g, '_')}`;
        const logRef = doc(db, "tracking_logs", logId);
        batch.set(logRef, {
          tracking_code: orderDoc.id,
          status,
          timestamp: now,
          location: location || "N/A",
          note: note || `Cập nhật trạng thái xe ${truckCode}: ${status}`
        });
      });

      await batch.commit();

      // Notify users
      const trackingCodes = ordersSnap.docs.map(d => d.id);
      createNotifications(trackingCodes, status, location || "N/A");

      res.json({ success: true });
    } catch (error: any) {
      console.error("Update truck status error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/trucks/:id", async (req, res) => {
    try {
      const truckId = req.params.id;
      const truckRef = doc(db, "trucks", truckId);
      
      // Delete truck
      await deleteDoc(truckRef);
      
      // Optional: Update orders to remove truck_code or delete them?
      // Usually better to just remove truck_code so they aren't orphaned
      const ordersQuery = query(collection(db, "orders"), where("truck_code", "==", truckId));
      const ordersSnap = await getDocs(ordersQuery);
      
      const batch = writeBatch(db);
      ordersSnap.forEach((orderDoc) => {
        batch.update(doc(db, "orders", orderDoc.id), {
          truck_code: null
        });
      });
      await batch.commit();

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/orders/:id", async (req, res) => {
    try {
      const orderId = req.params.id;
      const orderRef = doc(db, "orders", orderId);
      
      // Get order to update truck count
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const truckCode = orderSnap.data().truck_code;
        if (truckCode) {
          const truckRef = doc(db, "trucks", truckCode);
          const truckSnap = await getDoc(truckRef);
          if (truckSnap.exists()) {
            await updateDoc(truckRef, {
              order_count: Math.max(0, (truckSnap.data().order_count || 1) - 1)
            });
          }
        }
      }

      await deleteDoc(orderRef);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/orders/:id", async (req, res) => {
    try {
      const orderId = req.params.id;
      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      const oldStatus = orderSnap.exists() ? orderSnap.data().status : null;
      
      await updateDoc(orderRef, {
        ...req.body,
        last_updated: new Date().toISOString()
      });

      if (req.body.status && req.body.status !== oldStatus) {
        createNotifications([orderId], req.body.status, req.body.location || "N/A");
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
