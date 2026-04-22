export const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Lỗi máy chủ, vui lòng thử lại sau";

  if (err.code === 11000) {
    statusCode = 409;
    message = "Dữ liệu bị trùng";
  }

  const errorResponse = {
    success: false,
    message,
  };

  if (process.env.NODE_ENV === "development") {
    errorResponse.error = {
      name: err.name,
      message: err.message,
    };
    errorResponse.stack = err.stack;
  }

  return res.status(statusCode).json(errorResponse);
};