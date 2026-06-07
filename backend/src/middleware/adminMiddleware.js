export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    const error = new Error("Bạn không có quyền truy cập tài nguyên này.");
    error.statusCode = 403;
    return next(error);
  }
  next();
};
