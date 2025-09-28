# Get Real Hedera Testnet Credentials

🚨 **CRITICAL: Demo credentials won't work for hackathon submission**

The current demo credentials in `.env` are fake and will cause `PAYER_ACCOUNT_NOT_FOUND` errors.

## Option 1: Hedera Developer Portal (Recommended - 1000 HBAR)

1. **Visit**: https://portal.hedera.com/register
2. **Sign up** with your email
3. **Complete profile** setup
4. **Select "Testnet"** from network dropdown
5. **Create account** - automatically funded with 1000 HBAR
6. **Copy credentials**:
   - Account ID (format: 0.0.xxxxxxx)
   - Private Key (HEX format)
   - Public Key

## Option 2: Anonymous Faucet (Quick - 100 HBAR)

1. **Visit**: https://portal.hedera.com/faucet
2. **Enter EVM wallet address** (e.g., MetaMask address)
3. **Get 100 HBAR** automatically
4. **Export private key** from your wallet (MetaMask → Account Details → Export Private Key)

## Option 3: HashPack Wallet (User-friendly - 100 HBAR)

1. **Visit**: https://www.hashpack.app/
2. **Create wallet** → Advanced Creation → ECDSA Account
3. **Enable testnet** account creation
4. **Get 100 HBAR** automatically
5. **Export private key** from wallet settings

## Update Environment Variables

Once you have real credentials, update `.env`:

```bash
# Replace with your real credentials
OPERATOR_ID=0.0.YOUR_REAL_ACCOUNT_ID
OPERATOR_KEY=YOUR_REAL_PRIVATE_KEY_HEX
```

## Verify Credentials

```bash
# Test connection
curl http://localhost:3001/api/hedera/status

# Should return: {"network":"testnet","connected":true}
```

## Next Steps

1. Get real credentials using one of the options above
2. Update `.env` file
3. Restart backend server: `npm run dev`
4. Test invoice creation with real Hedera integration

---

**⚠️ For Hackathon Success**: Use Option 1 (Developer Portal) for maximum HBAR balance and best testing experience.