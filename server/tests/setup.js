process.env.NODE_ENV = "test";

process.env.CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || "cirql-test-access-secret";

process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "cirql-test-refresh-secret";
