import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET ?? '',
  genesisUsername: process.env.GENESIS_SUPERADMIN_USERNAME ?? '',
  genesisPassword: process.env.GENESIS_SUPERADMIN_PASSWORD ?? '',
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is required');
}
