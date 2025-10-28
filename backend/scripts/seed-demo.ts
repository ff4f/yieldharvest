#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

interface DemoUser {
  id: string;
  email: string;
  name: string;
  hederaAccountId: string | null;
}

interface DemoInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  status: string;
  supplierId: string;
  buyerId: string | null;
  description: string;
  nftTokenId?: string | null;
  fileId?: string | null;
  topicId?: string | null;
}

class DemoSeeder {
  private users: DemoUser[] = [];
  private invoices: DemoInvoice[] = [];

  async seed() {
    console.log('🌱 Starting demo data seeding...');

    try {
      // Clean existing data
      await this.cleanDatabase();

      // Create demo users
      await this.createDemoUsers();

      // Create demo invoices
      await this.createDemoInvoices();

      // Create demo funding
      await this.createDemoFunding();

      console.log('✅ Demo data seeding completed successfully!');
      console.log(`Created ${this.users.length} users and ${this.invoices.length} invoices`);

    } catch (error) {
      console.error('❌ Demo seeding failed:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  private async cleanDatabase() {
    console.log('🧹 Cleaning existing demo data...');

    // Delete in correct order to respect foreign key constraints
    await prisma.funding.deleteMany({});
    await prisma.invoiceEvent.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.investor.deleteMany({});
    await prisma.user.deleteMany({});

    console.log('✅ Database cleaned');
  }

  private async createDemoUsers() {
    console.log('👥 Creating demo users...');

    const demoUsers = [
      {
        email: 'supplier1@yieldharvest.com',
        name: 'AgriSupply Corp',
        hederaAccountId: '0.0.1001',
        role: 'SUPPLIER'
      },
      {
        email: 'supplier2@yieldharvest.com',
        name: 'FarmTech Solutions',
        hederaAccountId: '0.0.1002',
        role: 'SUPPLIER'
      },
      {
        email: 'buyer1@yieldharvest.com',
        name: 'Global Food Distributors',
        hederaAccountId: '0.0.1003',
        role: 'BUYER'
      },
      {
        email: 'buyer2@yieldharvest.com',
        name: 'Organic Market Chain',
        hederaAccountId: '0.0.1004',
        role: 'BUYER'
      },
      {
        email: 'investor1@yieldharvest.com',
        name: 'Green Capital Fund',
        hederaAccountId: '0.0.1005',
        role: 'INVESTOR'
      },
      {
        email: 'investor2@yieldharvest.com',
        name: 'Sustainable Agriculture Ventures',
        hederaAccountId: '0.0.1006',
        role: 'INVESTOR'
      }
    ];

    for (const userData of demoUsers) {
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          role: userData.role,
          hederaAccountId: userData.hederaAccountId,
          createdAt: faker.date.past({ years: 1 }),
          updatedAt: new Date()
        }
      });

      this.users.push(user);
    }

    console.log(`✅ Created ${this.users.length} demo users`);
  }

  private async createDemoInvoices() {
    console.log('📄 Creating demo invoices...');

    const suppliers = this.users.filter(u => u.email.includes('supplier'));
    const buyers = this.users.filter(u => u.email.includes('buyer'));

    const invoiceTemplates = [
      {
        description: 'Organic Wheat Supply - Q1 2024',
        amount: 25000,
        status: 'FUNDED'
      },
      {
        description: 'Premium Rice Seeds - Spring Planting',
        amount: 18500,
        status: 'ISSUED'
      },
      {
        description: 'Fertilizer and Nutrients Package',
        amount: 12750,
        status: 'PAID'
      },
      {
        description: 'Irrigation Equipment Installation',
        amount: 45000,
        status: 'ISSUED'
      },
      {
        description: 'Harvest Processing Services',
        amount: 32000,
        status: 'FUNDED'
      }
    ];

    for (let i = 0; i < invoiceTemplates.length; i++) {
      const template = invoiceTemplates[i];
      const supplier = suppliers[i % suppliers.length];
      const buyer = buyers[i % buyers.length];

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-${new Date().getFullYear()}-${String(1000 + i).padStart(4, '0')}`,
          amount: template.amount,
          dueDate: faker.date.future({ years: 1 }),
          status: template.status,
          description: template.description,
          supplierId: supplier.id,
          buyerId: buyer.id,
          // Simulate Hedera integration
          nftTokenId: template.status !== 'ISSUED' ? `0.0.${2000 + i}` : null,
          fileId: `0.0.${3000 + i}`,
          topicId: `0.0.${4000 + i}`,
          createdAt: faker.date.past({ years: 1 }),
          updatedAt: new Date()
        }
      });

      this.invoices.push(invoice);
    }

    console.log(`✅ Created ${this.invoices.length} demo invoices`);
  }

  private async createDemoFunding() {
    console.log('💰 Creating demo funding...');

    const investors = this.users.filter(u => u.email.includes('investor'));
    
    // First create investor profiles for the investor users
    for (const investor of investors) {
      await prisma.investor.create({
        data: {
          userId: investor.id,
          availableBalance: 100000,
          totalInvested: 0,
          totalReturns: 0,
          riskTolerance: 'MEDIUM'
        }
      });
    }

    const fundableInvoices = this.invoices.filter(inv => 
      inv.status === 'ISSUED' || inv.status === 'FUNDED'
    );

    for (const invoice of fundableInvoices) {
      const investor = faker.helpers.arrayElement(investors);
      
      await prisma.funding.create({
        data: {
          invoiceId: invoice.id,
          investorId: investor.id,
          amount: invoice.amount * 0.8, // 80% funding
          interestRate: 0.05, // 5% interest
          status: invoice.status === 'FUNDED' ? 'ACTIVE' : 'ACTIVE',
          fundedAt: faker.date.past({ years: 1 }),
          createdAt: faker.date.past({ years: 1 }),
          updatedAt: new Date()
        }
      });
    }

    console.log(`✅ Created funding for ${fundableInvoices.length} invoices`);
  }
}

// Run seeder if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const seeder = new DemoSeeder();
  seeder.seed()
    .then(() => {
      console.log('🎉 Demo seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demo seeding failed:', error);
      process.exit(1);
    });
}

export default DemoSeeder;