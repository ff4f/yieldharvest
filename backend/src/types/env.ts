import { Type, Static } from '@sinclair/typebox';

export const envSchema = Type.Object({
  PORT: Type.String({ default: '3000' }),
  HOST: Type.String({ default: '0.0.0.0' }),
  NODE_ENV: Type.String({ default: 'development' }),
  LOG_LEVEL: Type.String({ default: 'info' }),
  DATABASE_URL: Type.String(),
  OPERATOR_ID: Type.String(),
  OPERATOR_KEY: Type.String(),
  HEDERA_NETWORK: Type.String({ default: 'testnet' }),
  MIRROR_NODE_URL: Type.String({ default: 'https://testnet.mirrornode.hedera.com' }),
});

export type EnvConfig = Static<typeof envSchema>;

// Alternative Zod schema for validation
import { z } from 'zod';

export const envSchemaZod = z.object({
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string(),
  OPERATOR_ID: z.string(),
  OPERATOR_KEY: z.string(),
  HEDERA_NETWORK: z.string().default('testnet'),
  MIRROR_NODE_URL: z.string().default('https://testnet.mirrornode.hedera.com'),
  // Contract-related environment variables (optional)
  PRIVATE_KEY: z.string().optional(),
  ESCROW_CONTRACT_ADDRESS: z.string().optional(),
  JSON_RPC_URL: z.string().optional(),
});

export type EnvConfigZod = z.infer<typeof envSchemaZod>;