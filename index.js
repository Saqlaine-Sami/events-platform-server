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

// ---------- JWT verify middleware ----------
// BetterAuth (Next.js) এর JWKS endpoint থেকে public key নিয়ে token যাচাই করে
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "অনুমতি নেই: টোকেন পাওয়া যায়নি" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.CLIENT_URL,
    });
    req.user = payload; // payload.email, payload.name পাওয়া যাবে
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "অনুমতি নেই: টোকেন সঠিক নয় বা মেয়াদ শেষ" });
  }
};

// ---------- Helpers ----------
const EVENT_TYPES = [
  "Cleanup",
  "Plantation",
  "Donation",
  "Blood Donation",
  "Food Distribution",
  "Education Camp",
];

// বাংলাদেশ সময় অনুযায়ী আজকের তারিখ (YYYY-MM-DD)
const todayStr = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

function validateEvent(b) {
  if (!b.title || b.title.trim().length < 5)
    return "টাইটেল কমপক্ষে ৫ অক্ষরের হতে হবে";
  if (!b.description || b.description.trim().length < 20)
    return "বর্ণনা কমপক্ষে ২০ অক্ষরের হতে হবে";
  if (!EVENT_TYPES.includes(b.eventType)) return "ইভেন্ট টাইপ সঠিক নয়";
  try {
    new URL(b.thumbnail);
  } catch {
    return "সঠিক থাম্বনেইল URL দিন";
  }
  if (!b.location || b.location.trim().length < 3) return "লোকেশন দিন";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) return "সঠিক তারিখ দিন";
  if (b.date <= todayStr()) return "ইভেন্টের তারিখ অবশ্যই ভবিষ্যতের হতে হবে";
  return null;
}

const pickEvent = (b) => ({
  title: b.title.trim(),
  description: b.description.trim(),
  eventType: b.eventType,
  thumbnail: b.thumbnail.trim(),
  location: b.location.trim(),
  date: b.date,
});

// ===== নিচের marker-এর পরে নতুন নতুন route/middleware যোগ করবে =====
// ---- routes ----

// ===== এই লাইনের নিচের অংশ সবসময় ফাইলের শেষে থাকবে =====
export default app; // Vercel-এর জন্য
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`Server running on port ${port}`));
}