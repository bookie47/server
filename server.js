import express from "express";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ route สำหรับทดสอบว่าเซิร์ฟเวอร์ออนไลน์
app.get("/", (req, res) => {
  res.send("✅ ESP32 Proxy is running successfully!");
});

// รับข้อมูลจาก ESP32 แล้วส่งต่อไปยัง Dashboard
app.post("/api/update", async (req, res) => {
  console.log("📩 Data from ESP32:", req.body);
  try {
    const resp = await fetch("https://dashboard-servo.vercel.app/api/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await resp.text();
    res.status(200).send(data);
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
});

const server = app.listen(3000, () => {
  console.log("✅ Proxy running on port 3000");
});

// WebSocket สำหรับ dashboard
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  console.log("🌐 WebSocket connected");
});
