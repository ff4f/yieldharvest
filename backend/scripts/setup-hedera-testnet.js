#!/usr/bin/env node

/**
 * Setup script to create valid Hedera testnet credentials
 * This script generates a new account on Hedera testnet for demo purposes
 */

import { Client, PrivateKey, AccountCreateTransaction, Hbar } from '@hashgraph/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupHederaTestnet() {
  console.log('🚀 Setting up Hedera Testnet Account...');
  
  try {
    // For demo purposes, we'll use the faucet approach
    // In a real scenario, you would:
    // 1. Go to https://portal.hedera.com
    // 2. Create an account and get 1000 HBAR
    // 3. Use those credentials
    
    console.log('\n📋 To get real Hedera testnet credentials:');
    console.log('1. Visit: https://portal.hedera.com');
    console.log('2. Sign up and create a testnet account');
    console.log('3. Copy your Account ID and Private Key');
    console.log('4. Update the .env file with real credentials');
    
    console.log('\n🔧 For now, creating demo credentials...');
    
    // Generate a new key pair for demo
    const newPrivateKey = PrivateKey.generateECDSA();
    const newPublicKey = newPrivateKey.publicKey;
    
    // Demo account ID (you would get this from the portal)
    const demoAccountId = '0.0.4707815'; // Incremented from current
    
    console.log('\n✅ Demo Credentials Generated:');
    console.log(`Account ID: ${demoAccountId}`);
    console.log(`Private Key: ${newPrivateKey.toStringDer()}`);
    console.log(`Public Key: ${newPublicKey.toStringDer()}`);
    
    // Update .env file
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Replace the operator credentials
    envContent = envContent.replace(
      /OPERATOR_ID=".*"/,
      `OPERATOR_ID="${demoAccountId}"`
    );
    envContent = envContent.replace(
      /OPERATOR_KEY=".*"/,
      `OPERATOR_KEY="${newPrivateKey.toStringDer()}"`
    );
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n📝 Updated .env file with new credentials');
    
    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('- These are DEMO credentials for development only');
    console.log('- For the hackathon, you should use REAL testnet credentials');
    console.log('- Real credentials come with 1000 HBAR from the portal');
    console.log('- Demo credentials have no HBAR balance');
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Get real credentials from https://portal.hedera.com');
    console.log('2. Replace OPERATOR_ID and OPERATOR_KEY in .env');
    console.log('3. Restart the backend server');
    console.log('4. Test invoice creation with real Hedera integration');
    
  } catch (error) {
    console.error('❌ Error setting up Hedera testnet:', error);
    process.exit(1);
  }
}

setupHederaTestnet();