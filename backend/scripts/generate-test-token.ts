#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { generateAccessToken, UserRole } from '../src/middleware/auth.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateTestToken() {
  try {
    // Get the first supplier user from the database
    const supplier = await prisma.user.findFirst({
      where: { role: 'SUPPLIER' },
    });

    if (!supplier) {
      console.error('❌ No supplier user found. Please run: npm run db:seed');
      process.exit(1);
    }

    // Generate JWT token for the supplier
    const token = generateAccessToken({
      id: supplier.id,
      accountId: supplier.hederaAccountId || '0.0.6435668',
      role: UserRole.SUPPLIER,
      email: supplier.email,
    });

    console.log('🔑 Test JWT Token Generated:');
    console.log('📋 User Details:');
    console.log(`   - ID: ${supplier.id}`);
    console.log(`   - Name: ${supplier.name}`);
    console.log(`   - Email: ${supplier.email}`);
    console.log(`   - Role: ${supplier.role}`);
    console.log(`   - Hedera Account: ${supplier.hederaAccountId}`);
    console.log('');
    console.log('🎫 JWT Token:');
    console.log(token);
    console.log('');
    console.log('📝 Usage Example:');
    console.log(`curl -X POST http://localhost:3001/api/invoices \\`);
    console.log(`  -H "Authorization: Bearer ${token}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{`);
    console.log(`    "customerName": "Test Customer",`);
    console.log(`    "amount": 1000,`);
    console.log(`    "currency": "HBAR",`);
    console.log(`    "dueDate": "${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}",`);
    console.log(`    "description": "Test invoice for blockchain integration"`);
    console.log(`  }'`);
    
  } catch (error) {
    console.error('❌ Error generating test token:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

generateTestToken();