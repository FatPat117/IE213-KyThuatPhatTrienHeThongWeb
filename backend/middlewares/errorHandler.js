/**
 * Middleware xử lý lỗi toàn cục.
 * Bắt mọi error từ route/controller, trả JSON thống nhất.
 */
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  const status = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ success: false, error: message });
}

module.exports = errorHandler;
