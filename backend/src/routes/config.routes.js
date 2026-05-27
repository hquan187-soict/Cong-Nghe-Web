import express from "express";

const router = express.Router();

router.get("/webrtc", (req, res) => {
  return res.status(200).json({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  });
});

export default router;