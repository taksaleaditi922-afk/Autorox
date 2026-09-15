JWT_SECRET: process.env.JWT_SECRET || 'supersecret-jwt-key-change-me',
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '30m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'super-refresh-key-change-me'