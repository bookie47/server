import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors());
app.use(express.json());

let latestData = {}; // เก็บข้อมูลล่าสุดจาก ESP32

// ✅ รับข้อมูลจาก ESP32 (HTTP POST)
app.post("/api/update", (req, res) => {
  latestData = req.body;
  console.log("📩 Data from ESP32:", latestData);
  broadcastToClients(latestData); // ส่งต่อให้ทุก Dashboard ที่เชื่อมต่อ
  res.json({ ok: true });
});

// ✅ สำหรับ Dashboard ที่ยังไม่ได้เปิด WebSocket
app.get("/api/data", (req, res) => {
  res.json(latestData);
});

const server = app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});

// ✅ สร้าง WebSocket Server
const wss = new WebSocketServer({ server });
let clients = new Set();

wss.on("connection", (ws) => {
  console.log("🌐 Dashboard connected via WebSocket");
  clients.add(ws);
  ws.send(JSON.stringify({ type: "init", data: latestData }));

  ws.on("close", () => {
    clients.delete(ws);
    console.log("❌ Dashboard disconnected");
  });
});

function broadcastToClients(data) {
  const msg = JSON.stringify({ type: "update", data });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}
