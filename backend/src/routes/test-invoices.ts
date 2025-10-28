import { FastifyInstance } from 'fastify';
import { invoiceService, InvoiceStatus } from '../services/invoices';

export async function testInvoiceRoutes(fastify: FastifyInstance) {
  // Test route to create invoice without authentication
  fastify.post('/test/invoices', async (request, reply) => {
    try {
      const body = request.body as any;
      
      const invoice = await invoiceService.createInvoice({
        invoiceNumber: body.invoiceNumber || `TEST-${Date.now()}`,
        supplierId: body.supplierId || 'test-supplier',
        buyerId: body.buyerId || 'test-buyer',
        amount: parseFloat(body.amount || '1000'),
        currency: body.currency || 'USD',
        dueDate: new Date(body.dueDate || '2024-12-31T23:59:59Z'),
        description: body.description || 'Test invoice',
        status: InvoiceStatus.ISSUED,
        nftTokenId: body.nftTokenId,
        nftSerialNumber: body.nftSerialNumber,
        fileId: body.fileId,
        fileHash: body.fileHash,
        topicId: body.topicId
      });

      return reply.code(201).send({ data: invoice });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to create test invoice');
      return reply.code(500).send({ error: 'Failed to create test invoice' });
    }
  });

  // Test route to get all invoices without authentication
  fastify.get('/test/invoices', async (request, reply) => {
    try {
      const invoices = await invoiceService.getAllInvoices();
      return reply.send({ data: invoices });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to fetch test invoices');
      return reply.code(500).send({ error: 'Failed to fetch test invoices' });
    }
  });

  // Test route to get invoice by ID without authentication
  fastify.get('/test/invoices/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const invoice = await invoiceService.getInvoiceById(id);
      
      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }
      
      return reply.send({ data: invoice });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to fetch test invoice');
      return reply.code(500).send({ error: 'Failed to fetch test invoice' });
    }
  });
}