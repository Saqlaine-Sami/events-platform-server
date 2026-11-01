import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:3000"].filter(Boolean),
  })
);
app.use(express.json());

// ---------- MongoDB connection (cache করা, Vercel-এও কাজ করবে) ----------
let cached = null;
async function getCollections() {
  if (!cached) {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db("social_events_db");
    cached = {
      events: db.collection("events"),
      joins: db.collection("joins"),
    };
  }
  return cached;
}

app.use(async (req, res, next) => {
  try {
    req.col = await getCollections();
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "ডাটাবেজ কানেকশনে সমস্যা হয়েছে" });
  }
});

// async route-এর error ধরার helper
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ message: "সার্ভারে সমস্যা হয়েছে" });
  });

app.get("/", (req, res) => {
  res.json({ message: "HelpingHands BD server is running" });
});

// ===== নিচের marker-এর পরে নতুন নতুন route/middleware যোগ করবে =====
// ---- routes ----

// ===== এই লাইনের নিচের অংশ সবসময় ফাইলের শেষে থাকবে =====
export default app; // Vercel-এর জন্য
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`Server running on port ${port}`));
}