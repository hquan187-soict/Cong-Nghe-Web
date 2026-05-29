import express from "express";

const router = express.Router();

router.get("/webrtc", (req, res) => {
  return res.status(200).json({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: "b093b6c7c55419d7e279b917",
        credential: "1XJMdsry7hsFqaLU",
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: "b093b6c7c55419d7e279b917",
        credential: "1XJMdsry7hsFqaLU",
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: "b093b6c7c55419d7e279b917",
        credential: "1XJMdsry7hsFqaLU",
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: "b093b6c7c55419d7e279b917",
        credential: "1XJMdsry7hsFqaLU",
      },
    ],
  });
});

export default router;