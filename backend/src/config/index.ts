import { envSchemaZod } from '../types/env';

// Parse and validate environment variables
const env = envSchemaZod.parse(process.env);

export const config = {
  server: {
    port: parseInt(env.PORT),
    host: env.HOST,
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
  },
  database: {
    url: env.DATABASE_URL,
  },
  hedera: {
    operatorId: env.OPERATOR_ID,
    operatorKey: env.OPERATOR_KEY,
    network: env.HEDERA_NETWORK as 'testnet' | 'mainnet',
    mirrorNodeUrl: env.MIRROR_NODE_URL,
    // Contract-related config
    privateKey: process.env.PRIVATE_KEY,
    escrowContractAddress: process.env.ESCROW_CONTRACT_ADDRESS,
    jsonRpcUrl: process.env.JSON_RPC_URL || (
      env.HEDERA_NETWORK === 'mainnet' 
        ? 'https://mainnet.hashio.io/api'
        : 'https://testnet.hashio.io/api'
    ),
  },
};

export default config;