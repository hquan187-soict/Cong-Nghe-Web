// Global rate limiter: 10 requests per second per IP

const rateLimitWindowMs = 1000;
const maxRequests = 10;
const ipRequestMap = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, requestInfo] of ipRequestMap) {
    if (now - requestInfo.startTime > rateLimitWindowMs) {
      ipRequestMap.delete(ip);
    }
  }
}, 10000);

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
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

export const createRateLimiter = ({ windowMs, maxRequests, keyGenerator, message }) => {
  const requestMap = new Map();
  const msg = message || 'Quá nhiều yêu cầu, vui lòng thử lại sau.';
  const getKey = keyGenerator || ((req) => req.ip || req.connection.remoteAddress || "unknown");

  setInterval(() => {
    const now = Date.now();
    for (const [key, requestInfo] of requestMap) {
      if (now - requestInfo.startTime > windowMs) {
        requestMap.delete(key);
      }
    }
  }, Math.min(windowMs, 10000));

  return (req, res, next) => {
    const key = getKey(req) || "unknown";
    const now = Date.now();
    let requestInfo = requestMap.get(key);

    if (!requestInfo) {
      requestInfo = { count: 1, startTime: now };
      requestMap.set(key, requestInfo);
      return next();
    }

    if (now - requestInfo.startTime > windowMs) {
      requestMap.delete(key);
      requestInfo = { count: 1, startTime: now };
      requestMap.set(key, requestInfo);
      return next();
    }

    requestInfo.count += 1;
    if (requestInfo.count > maxRequests) {
      return res.status(429).json({ message: msg });
    }

    next();
  };
};

export default rateLimiter;
