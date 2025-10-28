import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-ethers';
import dotenv from 'dotenv';

dotenv.config();

export default {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hederaTestnet: {
      url: 'https://testnet.hashio.io/api',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 296,
      timeout: 120000,
      gas: 3000000,
      gasPrice: 450000000000, // Increased to meet minimum requirement
    },
    hederaMainnet: {
      url: 'https://mainnet.hashio.io/api', 
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 295,
      timeout: 120000,
      gas: 3000000,
      gasPrice: 10000000000,
    },
    hederaLocal: {
      url: 'http://localhost:7546',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 298,
      timeout: 120000,
      gas: 3000000,
      gasPrice: 10000000000,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test/contracts', 
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    timeout: 120000,
  },
};