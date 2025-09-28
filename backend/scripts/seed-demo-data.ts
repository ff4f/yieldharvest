#!/usr/bin/env ts-node

/**
 * Demo Data Seeder for YieldHarvest
 * Creates sample invoices, users, and basic Hedera interactions for demo purposes
 */

import { PrismaClient } from '@prisma/client';
import { HederaService } from '../src/services/hedera';
import { logger } from '../src/utils/logger';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
// Initialize Hedera service only if proper credentials are available
let hederaService: HederaService | null = null;
try {
  if (process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY && process.env.HEDERA_OPERATOR_KEY !== 'mock-key') {
    hederaService = new HederaService({
      operatorId: process.env.HEDERA_OPERATOR_ID,
      operatorKey: process.env.HEDERA_OPERATOR_KEY,
      network: process.env.HEDERA_NETWORK || 'testnet',
      mirrorNodeUrl: process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com'
    });
    logger.info('Hedera service initialized successfully');
  } else {
    logger.warn('Hedera credentials not configured - skipping on-chain operations');
  }
} catch (error) {
  logger.warn('Failed to initialize Hedera service - running in demo mode only:', error);
}

// Demo data configuration
const DEMO_INVOICES = [
  {
    customerName: 'TechCorp Solutions',
    amount: 15000,
    currency: 'HBAR',
    dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    description: 'Enterprise Software Development - Phase 1',
    status: 'ISSUED' as const
  },
  {
    customerName: 'Global Manufacturing Inc',
    amount: 25000,
    currency: 'HBAR',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    description: 'Supply Chain Management System',
    status: 'FUNDING_REQUESTED' as const
  },
  {
    customerName: 'FinanceFlow Ltd',
    amount: 12000,
    currency: 'HBAR',
    dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    description: 'Payment Processing Integration',
    status: 'FUNDED' as const
  },
  {
    customerName: 'Healthcare Systems Co',
    amount: 18000,
    currency: 'HBAR',
    dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    description: 'Patient Management Portal',
    status: 'PAID' as const
  },
  {
    customerName: 'EduTech Innovations',
    amount: 8500,
    currency: 'HBAR',
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    description: 'Learning Management System Module',
    status: 'ISSUED' as const
  }
];

const DEMO_USERS = [
  {
    id: 'demo-supplier-1',
    email: 'supplier@yieldharvest.demo',
    name: 'YieldHarvest Supplier',
    role: 'SUPPLIER' as const,
    hederaAccountId: process.env.HEDERA_OPERATOR_ID || '0.0.123456'
  },
  {
    id: 'demo-investor-1',
    email: 'investor@yieldharvest.demo',
    name: 'YieldHarvest Investor',
    role: 'INVESTOR' as const,
    hederaAccountId: process.env.HEDERA_INVESTOR_ID || '0.0.123457'
  },
  {
    id: 'demo-customer-1',
    email: 'customer@yieldharvest.demo',
    name: 'YieldHarvest Customer',
    role: 'CUSTOMER' as const,
    hederaAccountId: process.env.HEDERA_CUSTOMER_ID || '0.0.123458'
  }
];

class DemoSeeder {
  private async createSamplePDF(fileName: string): Promise<string> {
    const content = `
# Invoice Document

**Invoice Number:** ${fileName.replace('.pdf', '')}
**Date:** ${new Date().toLocaleDateString()}
**Amount:** Sample Amount
**Description:** Demo invoice for YieldHarvest platform

---

This is a sample invoice document generated for demonstration purposes.
In a real implementation, this would be a properly formatted PDF.
    `;
    
    const filePath = path.join(__dirname, '../temp', fileName);
    const tempDir = path.dirname(filePath);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  private async logToHCS(eventType: string, invoiceId: string, data: any) {
    if (!hederaService) {
      logger.info(`[DEMO MODE] Would log ${eventType} to HCS for invoice ${invoiceId}`);
      return { sequenceNumber: 'demo-seq-' + Date.now() };
    }
    
    try {
      const message = {
        eventType,
        invoiceId,
        timestamp: new Date().toISOString(),
        data
      };

      const topicId = process.env.HEDERA_TOPIC_ID || '0.0.789012';
      const result = await hederaService.submitTopicMessage(
        topicId,
        message
      );
      
      logger.info(`Logged ${eventType} to HCS:`, {
        topicId: topicId,
        sequenceNumber: result.sequenceNumber
      });
      
      return result;
    } catch (error) {
      logger.error(`Failed to log ${eventType} to HCS:`, error);
      return null;
    }
  }

  async seedUsers() {
    logger.info('Seeding demo users...');
    
    for (const userData of DEMO_USERS) {
      await prisma.user.upsert({
        where: { email: userData.email },
        update: userData,
        create: userData
      });
      
      logger.info(`Created/updated user: ${userData.name}`);
    }
  }

  async seedInvoices() {
    logger.info('Seeding demo invoices...');
    
    try {
      const supplier = await prisma.user.findFirst({ where: { role: 'SUPPLIER' } });
      const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
      
      if (!supplier || !customer) {
        throw new Error('Supplier and customer users must exist before seeding invoices');
      }
      
      logger.info(`Found supplier: ${supplier.name}, customer: ${customer.name}`);

    for (let i = 0; i < DEMO_INVOICES.length; i++) {
      const invoiceData = DEMO_INVOICES[i];
      
      // Create sample PDF
      const fileName = `invoice-${Date.now()}-${i}.pdf`;
      const filePath = await this.createSamplePDF(fileName);
      
      // Create invoice in database
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-${Date.now()}-${i}`,
          amount: invoiceData.amount,
          currency: invoiceData.currency,
          dueDate: invoiceData.dueDate,
          description: invoiceData.description,
          status: invoiceData.status,
          supplierId: supplier.id,
          buyerId: customer.id,
          // Basic file info (HFS upload would happen here in full implementation)
          fileId: `demo-file-${i}`,
          fileHash: `demo-hash-${i}`,
          // Demo NFT info
          nftTokenId: `0.0.${100000 + i}`,
          nftSerialNumber: (i + 1).toString()
        }
      });
      
      // Log to HCS
      await this.logToHCS('INVOICE_CREATED', invoice.id, {
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        status: invoice.status
      });
      
      // Create funding if status requires it
      if (invoiceData.status === 'FUNDED' || invoiceData.status === 'PAID') {
        const investor = await prisma.user.findFirst({ where: { role: 'INVESTOR' } });
        if (investor) {
          await prisma.funding.create({
            data: {
              invoiceId: invoice.id,
              investorId: investor.id,
              amount: Math.floor(invoiceData.amount * 0.8), // 80% advance
              status: invoiceData.status === 'PAID' ? 'RELEASED' : 'ACTIVE',
              fundedAt: new Date(),
              // Note: advanceRate, feeRate, fundingPeriod not in schema
            }
          });
          
          await this.logToHCS('FUNDING_PROVIDED', invoice.id, {
            investorId: investor.id,
            amount: Math.floor(invoiceData.amount * 0.8)
          });
        }
      }
      
      logger.info(`Created invoice: ${invoice.invoiceNumber} (${invoiceData.status})`);
      
      // Clean up temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    } catch (error) {
      console.error('Error seeding invoices:');
      console.error(error);
      logger.error('Error seeding invoices:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async generateProofLinks() {
    logger.info('\n=== DEMO PROOF LINKS ===');
    
    const invoices = await prisma.invoice.findMany({
      include: { fundings: true }
    });
    
    for (const invoice of invoices) {
      logger.info(`\nInvoice: ${invoice.invoiceNumber}`);
      logger.info(`- HashScan NFT: https://hashscan.io/testnet/token/${invoice.nftTokenId}`);
      logger.info(`- HFS File: https://hashscan.io/testnet/file/${invoice.fileId}`);
      logger.info(`- Mirror Node: https://testnet.mirrornode.hedera.com/api/v1/tokens/${invoice.nftTokenId}/nfts`);
      
      if (invoice.fundings.length > 0) {
         logger.info(`- Funding Status: ${invoice.fundings[0].status}`);
       }
    }
    
    logger.info('\n=== HCS TOPIC ===');
    logger.info(`Topic ID: ${process.env.HEDERA_TOPIC_ID || '0.0.789012'}`);
    logger.info(`HashScan: https://hashscan.io/testnet/topic/${process.env.HEDERA_TOPIC_ID || '0.0.789012'}`);
  }

  async cleanup() {
    logger.info('Cleaning up existing demo data...');
    
    await prisma.funding.deleteMany({
       where: {
         invoice: {
           invoiceNumber: {
             startsWith: 'INV-'
           }
         }
       }
     });
    
    await prisma.invoice.deleteMany({
      where: {
        invoiceNumber: {
          startsWith: 'INV-'
        }
      }
    });
    
    await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@yieldharvest.demo'
        }
      }
    });
  }
}

async function main() {
  try {
    const seeder = new DemoSeeder();
    
    logger.info('Starting demo data seeding...');
    
    await seeder.cleanup();
    await seeder.seedUsers();
    await seeder.seedInvoices();
    await seeder.generateProofLinks();
    
    logger.info('Demo data seeding completed successfully!');
  } catch (error) {
    logger.error('Demo data seeding failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DemoSeeder };