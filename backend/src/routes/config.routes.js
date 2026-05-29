import express from "express";

const router = express.Router();

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

let cachedTurnServers = null;
let cacheExpiry = 0;

async function getTurnServers() {
  if (cachedTurnServers && Date.now() < cacheExpiry) {
    return cachedTurnServers;
  }

  const apiKey = process.env.METERED_API_KEY;
  if (!apiKey) {
    console.warn("[CONFIG] METERED_API_KEY not set, using STUN only");
    return [];
  }

  try {
    const res = await fetch(
      `https://hoangquan-20239673-soict.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
    );
    if (!res.ok) throw new Error(`Metered API returned ${res.status}`);
    cachedTurnServers = await res.json();
    cacheExpiry = Date.now() + 12 * 60 * 60 * 1000;
    return cachedTurnServers;
  } catch (err) {
    console.error("[CONFIG] Failed to fetch TURN credentials:", err.message);
    return cachedTurnServers || [];
  }
}

router.get("/webrtc", async (req, res) => {
  const turnServers = await getTurnServers();
  return res.status(200).json({
    iceServers: [...STUN_SERVERS, ...turnServers],
  });
});

export default router;