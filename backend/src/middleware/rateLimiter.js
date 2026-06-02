// Limit: 10 requests per second per IP

const rateLimitWindowMs = 1000; // 1 second
const maxRequests = 10;
const ipRequestMap = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, requestInfo] of ipRequestMap) {
    if (now - requestInfo.startTime > rateLimitWindowMs) {
      ipRequestMap.delete(ip);
    }
  }
}, 60000);

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  let requestInfo = ipRequestMap.get(ip);

  if (!requestInfo) {
    requestInfo = { count: 1, startTime: now };
    ipRequestMap.set(ip, requestInfo);
    return next();
  }

  if (now - requestInfo.startTime > rateLimitWindowMs) {
    ipRequestMap.delete(ip);
    requestInfo = { count: 1, startTime: now };
    ipRequestMap.set(ip, requestInfo);
    return next();
  }

  requestInfo.count += 1;
  if (requestInfo.count > maxRequests) {
    return res.status(429).json({ message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' });
  }

  next();
};

export default rateLimiter;
