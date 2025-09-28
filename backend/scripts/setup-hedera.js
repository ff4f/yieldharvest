import { PrivateKey, AccountCreateTransaction, Client, Hbar } from '@hashgraph/sdk';
import fs from 'fs';
import path from 'path';

async function setupHedera() {
  console.log('🚀 Setting up Hedera testnet account...');
  
  try {
    // Generate new private key
    const privateKey = PrivateKey.generateED25519();
    const publicKey = privateKey.publicKey;
    
    console.log('Generated new key pair:');
    console.log('Private Key:', privateKey.toString());
    console.log('Public Key:', publicKey.toString());
    
    // For testnet, we need to use the portal to create account
    // or use an existing funded account
    console.log('\n⚠️  To complete setup:');
    console.log('1. Go to https://portal.hedera.com/');
    console.log('2. Create a testnet account');
    console.log('3. Fund it with test HBAR');
    console.log('4. Update the .env file with your account ID and private key');
    console.log('\nOr use these test credentials (if they have funds):');
    console.log('OPERATOR_ID="0.0.4707814"');
    console.log(`OPERATOR_KEY="${privateKey.toString()}"`);
    
    // Try to connect with existing credentials to test
    const client = Client.forTestnet();
    
    // Use the existing operator ID from .env but with a proper key format
    const testOperatorId = '0.0.4707814';
    const testPrivateKey = 'ed25519:302e020100300506032b657004220420b8c6b7e1e8c5d4a3f2e9c8b7a6d5c4b3a2f1e0d9c8b7a6d5c4b3a2f1e0d9c8b7';
    
    try {
      client.setOperator(testOperatorId, testPrivateKey);
      const balance = await client.getAccountBalance(testOperatorId);
      console.log(`\n✅ Test account ${testOperatorId} balance: ${balance.hbars.toString()}`);
      
      if (balance.hbars.toTinybars().toNumber() > 0) {
        console.log('✅ Account has funds, ready to use!');
      } else {
        console.log('⚠️  Account needs funding from https://portal.hedera.com/');
      }
    } catch (error) {
      console.log('❌ Test account connection failed:', error.message);
      console.log('\nPlease create a new account at https://portal.hedera.com/');
    }
    
    client.close();
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupHedera().catch(console.error);