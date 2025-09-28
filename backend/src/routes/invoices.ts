import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { invoiceService, CreateInvoiceSchema, UpdateInvoiceSchema, InvoiceStatus } from '../services/invoices';
import { invoiceDataMerger } from '../services/invoiceDataMerger';
import { authenticate, requireRole, UserRole } from '../middleware/auth';
import { validate, invoiceSchemas, paramSchemas } from '../middleware/validation';
import { auditLogger } from '../utils/logger';
import { NotFoundError } from '../middleware/errorHandler';

// Validation schemas
const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  supplierId: z.string().min(1),
  buyerId: z.string().min(1),
  agentId: z.string().optional(),
  amount: z.string().min(1),
  currency: z.string().min(3).max(3),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
});

const createInvoiceWithFileSchema = z.object({
  invoiceNumber: z.string().min(1),
  supplierId: z.string().min(1),
  buyerId: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().min(3).max(3),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
});

const updateInvoiceSchema = z.object({
  status: z.enum(['ISSUED', 'FUNDED', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  agentId: z.string().optional(),
  description: z.string().optional(),
});

export async function invoiceRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {

  // Get all invoices
  fastify.get('/', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER, UserRole.INVESTOR])],
    schema: {
      tags: ['invoices'],
      summary: 'Get all invoices',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          supplierId: { type: 'string' },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 10 },
        },
      },
    },
  }, async (request, reply) => {
    const { status, supplierId, page = 1, limit = 10 } = request.query as any;
    
    const filters: any = {};
    if (status) filters.status = status;
    if (supplierId) filters.supplierId = supplierId;

    const result = await invoiceDataMerger.getEnrichedInvoices(page, limit, filters);
    
    return result;
  });

  // Get invoice by ID
  fastify.get('/:id', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER, UserRole.INVESTOR])],
    schema: {
      tags: ['invoices'],
      summary: 'Get invoice by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const invoice = await fastify.prisma.invoice.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, email: true } },
        agent: { select: { id: true, name: true, email: true } },
        events: { orderBy: { createdAt: 'desc' } },
        fundings: {
          include: {
            investor: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!invoice) {
      return reply.code(404).send({ error: 'Invoice not found' });
    }

    return { data: invoice };
  });

  // Get detailed invoice by tokenId and serial number
  fastify.get('/nft/:tokenId/:serial', {
    schema: {
      tags: ['invoices'],
      summary: 'Get detailed invoice by NFT tokenId and serial number',
      params: {
        type: 'object',
        properties: {
          tokenId: { type: 'string' },
          serial: { type: 'string' },
        },
        required: ['tokenId', 'serial'],
      },
    },
  }, async (request, reply) => {
    const { tokenId, serial } = request.params as { tokenId: string; serial: string };

    try {
      const enrichedInvoice = await invoiceDataMerger.getDetailedInvoice(tokenId, parseInt(serial));
      
      if (!enrichedInvoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }

      return { data: enrichedInvoice };
    } catch (error) {
      fastify.log.error({ error }, 'Error fetching detailed invoice');
      return reply.code(500).send({ error: 'Failed to fetch invoice details' });
    }
  });

  // Create new invoice with full Hedera integration
  fastify.post('/', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER])]
  }, async (request, reply) => {
    try {
      fastify.log.info('=== STARTING MAIN POST ROUTE ===');
      
       // Parse multipart form data
       const parts = request.parts();
       let formData: Record<string, any> = {};
       let pdfFile: { buffer: Buffer; mimetype: string; filename?: string } | null = null;

       for await (const part of parts) {
           if (part.type === 'file') {
           if (part.fieldname === 'pdfFile') {
             pdfFile = {
               buffer: await part.toBuffer(),
               mimetype: part.mimetype || 'application/pdf',
               filename: part.filename,
             };
           }
         } else {
           formData[part.fieldname] = part.value;
         }
       }
       
      fastify.log.info({ formDataKeys: Object.keys(formData) }, 'Form fields received');
      fastify.log.info({ fileSize: pdfFile?.buffer.length }, 'File buffer size');

      // Validate form data
      const validatedData = createInvoiceWithFileSchema.parse(formData);
      
      fastify.log.info({ validatedData }, 'Validated form data');

      if (!pdfFile) {
        return reply.code(400).send({ error: 'PDF file is required' });
      }
      
      // Now that we've fixed the schema issue, let's proceed with real Hedera integration

      // Get tokenId and topicId from environment
      const tokenId = process.env['INVOICE_TOKEN_ID'];
      const topicId = process.env['INVOICE_TOPIC_ID'];

      if (!tokenId || !topicId) {
        return reply.code(500).send({ error: 'Token ID and Topic ID must be configured' });
      }

      // Step 1: Upload PDF to Hedera File Service
      fastify.log.info('Uploading PDF to HFS...');
      const hfsResult = await fastify.hedera.uploadPdfToHfs(
        pdfFile.buffer,
        pdfFile.mimetype,
        pdfFile.filename
      );

      // Step 2: Create invoice in database
      fastify.log.info('Creating invoice in database...');
      const invoice = await fastify.prisma.invoice.create({
        data: {
          invoiceNumber: validatedData.invoiceNumber,
          supplierId: validatedData.supplierId,
          buyerId: validatedData.buyerId,
          amount: parseFloat(validatedData.amount),
          currency: validatedData.currency,
          dueDate: new Date(validatedData.dueDate),
          description: validatedData.description,
          fileId: hfsResult.fileId,
          fileHash: hfsResult.fileHashSha384,
          status: 'ISSUED',
        },
        include: {
          supplier: { select: { id: true, name: true, email: true } },
        },
      });

      // Step 3: Mint NFT on Hedera Token Service
      fastify.log.info('Minting NFT on HTS...');
      const nftMetadata = {
        id: invoice.id.substring(0, 8),
        num: invoice.invoiceNumber.substring(0, 10),
        amt: validatedData.amount,
        cur: validatedData.currency,
        fid: hfsResult.fileId,
      };

      const nftResult = await fastify.hedera.mintInvoiceNFT(
        tokenId,
        nftMetadata
      );

      // Step 4: Submit status message to HCS
      fastify.log.info('Submitting status to HCS...');
      const hcsMessage = {
        tokenId: tokenId,
        serialNumber: nftResult.serialNumber,
        status: 'issued' as const,
        timestamp: new Date().toISOString(),
        fileHash: hfsResult.fileHashSha384,
        amount: validatedData.amount,
        currency: validatedData.currency,
      };

      const hcsResult = await fastify.hedera.submitInvoiceStatusMessage(
        topicId,
        hcsMessage
      );

      // Step 5: Update invoice with blockchain data
      const updatedInvoice = await fastify.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          nftTokenId: tokenId,
          nftSerialNumber: nftResult.serialNumber,
          fileId: hfsResult.fileId,
          fileHash: hfsResult.fileHashSha384,
          topicId: topicId,
        },
        include: {
          supplier: { select: { id: true, name: true, email: true } },
        },
      });

      // Step 6: Create invoice events
      await fastify.prisma.invoiceEvent.createMany({
        data: [
          {
            invoiceId: invoice.id,
            eventType: 'CREATED',
            description: 'Invoice created',
          },
          {
            invoiceId: invoice.id,
            eventType: 'FILE_UPLOADED',
            description: `PDF uploaded to HFS: ${hfsResult.fileId}`,
          },
          {
            invoiceId: invoice.id,
            eventType: 'NFT_MINTED',
            description: `NFT minted: ${tokenId}/${nftResult.serialNumber}`,
          },
          {
            invoiceId: invoice.id,
            eventType: 'HCS_SUBMITTED',
            description: `Status submitted to HCS: ${topicId}`,
          },
        ],
      });

      // Generate HashScan URLs for proof
      const hashScanUrls = {
        nft: `https://hashscan.io/testnet/token/${tokenId}/${nftResult.serialNumber}`,
        file: `https://hashscan.io/testnet/transaction/${hfsResult.transactionId}`,
        topic: `https://hashscan.io/testnet/topic/${topicId}`,
      };

      // Debug: Log the updatedInvoice object
      fastify.log.info({ updatedInvoice }, 'Updated invoice object');
      
      // Check if updatedInvoice exists
      if (!updatedInvoice) {
        fastify.log.error('updatedInvoice is null or undefined!');
        return reply.code(500).send({ error: 'Failed to update invoice' });
      }
      
      fastify.log.info({ id: updatedInvoice.id }, 'updatedInvoice.id');
       fastify.log.info({ invoiceNumber: updatedInvoice.invoiceNumber }, 'updatedInvoice.invoiceNumber');

       // Create a completely new plain object to avoid any Prisma serialization issues
       const completeInvoice = {
         id: updatedInvoice.id,
         invoiceNumber: updatedInvoice.invoiceNumber,
         supplierId: updatedInvoice.supplierId,
         buyerId: updatedInvoice.buyerId,
         agentId: updatedInvoice.agentId || null,
         amount: Number(updatedInvoice.amount),
         currency: updatedInvoice.currency,
         status: updatedInvoice.status,
         description: updatedInvoice.description || null,
         dueDate: updatedInvoice.dueDate ? updatedInvoice.dueDate.toISOString() : null,
         nftTokenId: updatedInvoice.nftTokenId || null,
         nftSerialNumber: updatedInvoice.nftSerialNumber || null,
         fileId: updatedInvoice.fileId || null,
         fileHash: updatedInvoice.fileHash || null,
         topicId: updatedInvoice.topicId || null,
         createdAt: updatedInvoice.createdAt ? updatedInvoice.createdAt.toISOString() : null,
         updatedAt: updatedInvoice.updatedAt ? updatedInvoice.updatedAt.toISOString() : null,
         supplier: updatedInvoice.supplier ? {
           id: updatedInvoice.supplier.id,
           name: updatedInvoice.supplier.name,
           email: updatedInvoice.supplier.email
         } : null
       };
       
       fastify.log.info('Created completeInvoice object');
       fastify.log.info({ exists: !!completeInvoice }, 'completeInvoice exists');

      // Create final response with actual data
      const responseData = {
        invoice: completeInvoice,
        nft: {
          tokenId: tokenId,
          serialNumber: nftResult.serialNumber,
          transactionId: nftResult.transactionId,
        },
        file: {
          fileId: hfsResult.fileId,
          fileHashSha384: hfsResult.fileHashSha384,
          transactionId: hfsResult.transactionId,
        },
        hcs: {
          transactionId: hcsResult.transactionId,
          sequenceNumber: hcsResult.sequenceNumber,
        },
        hashScanUrls: {
          nft: `https://hashscan.io/testnet/token/${tokenId}/${nftResult.serialNumber}`,
          file: `https://hashscan.io/testnet/transaction/${hfsResult.transactionId}`,
          topic: `https://hashscan.io/testnet/topic/${topicId}`,
        },
      };
      
      // Debug: Detailed logging of the completeInvoice object
       fastify.log.info('=== DEBUGGING COMPLETE INVOICE ===');
       fastify.log.info({ type: typeof completeInvoice }, 'Type of completeInvoice');
       fastify.log.info({ keys: Object.keys(completeInvoice) }, 'Object.keys(completeInvoice)');
       fastify.log.info({ stringified: JSON.stringify(completeInvoice) }, 'JSON.stringify(completeInvoice)');
       fastify.log.info({ id: completeInvoice.id }, 'completeInvoice.id');
       fastify.log.info({ invoiceNumber: completeInvoice.invoiceNumber }, 'completeInvoice.invoiceNumber');
       
       // Test with a simple copy
       const simpleCopy = {
         id: completeInvoice.id,
         invoiceNumber: completeInvoice.invoiceNumber,
         amount: completeInvoice.amount
       };
       fastify.log.info({ simpleCopy: JSON.stringify(simpleCopy) }, 'Simple copy');
      
      // Return the complete response with all Hedera transaction data
      const finalResponse = {
        data: {
          invoice: completeInvoice,
          nft: {
            tokenId: tokenId,
            serialNumber: nftResult.serialNumber,
            transactionId: nftResult.transactionId,
          },
          file: {
            fileId: hfsResult.fileId,
            fileHashSha384: hfsResult.fileHashSha384,
            transactionId: hfsResult.transactionId,
          },
          hcs: {
            transactionId: hcsResult.transactionId,
            sequenceNumber: hcsResult.sequenceNumber,
          },
          hashScanUrls: {
            nft: `https://hashscan.io/testnet/token/${tokenId}/${nftResult.serialNumber}`,
            file: `https://hashscan.io/testnet/transaction/${hfsResult.transactionId}`,
            topic: `https://hashscan.io/testnet/topic/${topicId}`,
          },
        },
      };
      
      fastify.log.info('Successfully created invoice with Hedera integration');
      fastify.log.info({ 
        invoiceId: completeInvoice.id,
        nftSerial: nftResult.serialNumber,
        fileId: hfsResult.fileId 
      }, 'Hedera transaction summary');
      
      return reply.code(201).send(finalResponse);
    } catch (error: unknown) {
       fastify.log.error({ error }, 'Failed to create invoice with Hedera integration');
       return reply.code(500).send({ 
         error: 'Failed to create invoice', 
         details: error instanceof Error ? error.message : String(error)
       });
     }
  });

  // Test serialization endpoint
  fastify.post('/test-serialization', async (request, reply) => {
    const testObject = {
      id: "test-id",
      name: "Test Invoice",
      amount: 1000,
      nested: {
        field1: "value1",
        field2: "value2"
      }
    };
    
    const response = {
      data: {
        invoice: testObject,
        other: "data"
      }
    };
    
    return reply.code(200).send(response);
  });

  // Test hardcoded response
  fastify.get('/test-hardcoded', async (request, reply) => {
    return reply.code(200).send({
      data: {
        invoice: {
          id: "hardcoded-id",
          invoiceNumber: "HARD-001",
          amount: 5000,
          currency: "USD",
          status: "ISSUED"
        }
      }
    });
  });

  // Test direct object return
  fastify.get('/test-direct', async (request, reply) => {
    const directInvoice = {
      id: "direct-id",
      invoiceNumber: "DIRECT-001",
      amount: 6000,
      currency: "USD",
      status: "ISSUED"
    };
    
    return { data: { invoice: directInvoice } };
  });

  // Test POST response structure
   fastify.post('/test-post-structure', async (request, reply) => {
     const testInvoice = {
       id: "test-post-id",
       invoiceNumber: "TEST-POST-123",
       amount: 2000,
       currency: "USD",
       status: 'ISSUED',
     };
     
     fastify.log.info({ testInvoice: JSON.stringify(testInvoice) }, 'Test POST invoice');
     
     const response = { data: { invoice: testInvoice } };
     fastify.log.info({ response: JSON.stringify(response) }, 'Test POST response');
     
     return reply.code(201).send(response);
   });

   // Test multipart form handling
   fastify.post('/test-multipart', async (request, reply) => {
     try {
       const parts = request.parts();
       let formData: Record<string, any> = {};
       let hasFile = false;

       for await (const part of parts) {
         if (part.type === 'file') {
           hasFile = true;
         } else {
           formData[part.fieldname] = part.value;
         }
       }

       const testResponse = {
         data: {
           invoice: {
             id: "multipart-test-id",
             invoiceNumber: formData.invoiceNumber || "DEFAULT-123",
             amount: parseInt(formData.amount || "1000"),
             currency: formData.currency || "USD",
             status: "ISSUED",
             hasFile: hasFile
           }
         }
       };

       fastify.log.info({ testResponse: JSON.stringify(testResponse) }, 'Multipart test response');
       return reply.code(201).send(testResponse);
     } catch (error) {
       fastify.log.error({ error }, 'Multipart test error');
       return reply.code(500).send({ error: 'Test failed' });
     }
   });

  // Create simple invoice (legacy endpoint)
  fastify.post('/simple', {
    schema: {
      tags: ['invoices'],
      summary: 'Create simple invoice without Hedera integration',
      body: {
        type: 'object',
        properties: {
          invoiceNumber: { type: 'string' },
          supplierId: { type: 'string' },
          buyerId: { type: 'string' },
          agentId: { type: 'string' },
          amount: { type: 'string' },
          currency: { type: 'string' },
          dueDate: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['invoiceNumber', 'supplierId', 'buyerId', 'amount', 'currency', 'dueDate'],
      },
    },
  }, async (request, reply) => {
    const body = createInvoiceSchema.parse(request.body);

    try {
      // Create invoice in database
      const invoice = await fastify.prisma.invoice.create({
        data: {
          ...body,
          amount: parseFloat(body.amount),
          dueDate: new Date(body.dueDate),
          status: 'ISSUED',
        },
        include: {
          supplier: { select: { id: true, name: true, email: true } },
          agent: { select: { id: true, name: true, email: true } },
        },
      });

      // Create invoice event
      await fastify.prisma.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: 'CREATED',
          description: 'Invoice created (simple mode)',
        },
      });

      return reply.code(201).send({ data: invoice });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to create invoice' });
    }
  });

  // Update invoice
  fastify.patch('/:id', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER])],
    schema: {
      tags: ['invoices'],
      summary: 'Update invoice',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          agentId: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateInvoiceSchema.parse(request.body);

    try {
      const invoice = await fastify.prisma.invoice.update({
        where: { id },
        data: body,
        include: {
          supplier: { select: { id: true, name: true, email: true } },
          agent: { select: { id: true, name: true, email: true } },
        },
      });

      // Create status change event if status was updated
      if (body.status) {
        await fastify.prisma.invoiceEvent.create({
          data: {
            invoiceId: invoice.id,
            eventType: body.status === 'FUNDED' ? 'FUNDED' : 'CREATED',
            description: `Invoice status changed to ${body.status}`,
          },
        });

        // TODO: Submit to HCS topic
        // await fastify.hedera.submitTopicMessage(invoice.topicId, {
        //   invoiceId: invoice.id,
        //   status: body.status,
        //   timestamp: new Date().toISOString(),
        // });
      }

      return { data: invoice };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to update invoice' });
    }
  });

  // Upload invoice document
  fastify.post('/:id/upload', {
    schema: {
      tags: ['invoices'],
      summary: 'Upload invoice document',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      
      // TODO: Upload to Hedera File Service
      // const fileResult = await fastify.hedera.uploadFile(
      //   buffer,
      //   `Invoice ${id} document`
      // );

      // Update invoice with file information
      const invoice = await fastify.prisma.invoice.update({
        where: { id },
        data: {
          // fileId: fileResult.fileId,
          // fileHash: fileResult.hash,
        },
      });

      // Create file upload event
      await fastify.prisma.invoiceEvent.create({
        data: {
          invoiceId: id,
          eventType: 'FILE_UPLOADED',
          description: 'Invoice document uploaded',
        },
      });

      return { 
        data: { 
          message: 'File uploaded successfully',
          // fileId: fileResult.fileId,
          // hash: fileResult.hash,
        } 
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to upload file' });
    }
  });
}