export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cashier',
    useMemory: process.env.MONGODB_USE_MEMORY || 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  nsq: {
    enabled: process.env.NSQ_ENABLED !== 'false',
    host: process.env.NSQ_HOST || 'localhost',
    port: parseInt(process.env.NSQ_PORT || '4150', 10),
    lookupdHost: process.env.NSQLOOKUPD_HOST || 'localhost',
    lookupdPort: parseInt(process.env.NSQLOOKUPD_PORT || '4161', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || undefined,
  },
  rateLimit: {
    perMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || undefined,
  },
  masterEncryptionKey: process.env.MASTER_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef',
  cashierBaseUrl: process.env.CASHIER_BASE_URL || 'http://localhost:8080',
});
