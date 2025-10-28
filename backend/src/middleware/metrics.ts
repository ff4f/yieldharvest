import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import client from 'prom-client';

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const hederaTxDuration = new client.Histogram({
  name: 'hedera_tx_duration_seconds',
  help: 'Duration of Hedera transactions in seconds',
  labelNames: ['type', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

const mirrorNodeLatency = new client.Histogram({
  name: 'mirror_node_latency_seconds',
  help: 'Latency of Mirror Node API calls in seconds',
  labelNames: ['endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const websocketClientsGauge = new client.Gauge({
  name: 'websocket_clients_gauge',
  help: 'Number of active WebSocket clients',
  registers: [register],
});

const hcsMessageLatency = new client.Histogram({
  name: 'hcs_message_latency_seconds',
  help: 'Latency of HCS message processing in seconds',
  labelNames: ['topic_id', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const cacheHitRate = new client.Counter({
  name: 'cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'result'],
  registers: [register],
});

const invoiceProcessingDuration = new client.Histogram({
  name: 'invoice_processing_duration_seconds',
  help: 'Duration of invoice processing operations',
  labelNames: ['operation', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Middleware to track HTTP metrics
export async function metricsMiddleware(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    request.startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = (Date.now() - (request.startTime || Date.now())) / 1000;
    const route = request.routeOptions?.url || request.url;
    const method = request.method;
    const statusCode = reply.statusCode.toString();

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  });

  // Metrics endpoint
  fastify.get('/metrics', async (request, reply) => {
    reply.type('text/plain');
    return register.metrics();
  });
}

// Export metrics for use in services
export const metrics = {
  httpRequestsTotal,
  httpRequestDuration,
  hederaTxDuration,
  mirrorNodeLatency,
  websocketClientsGauge,
  hcsMessageLatency,
  cacheHitRate,
  invoiceProcessingDuration,
  register,
};

// Helper functions for tracking specific operations
export const trackHederaTransaction = (type: string) => {
  const startTime = Date.now();
  return {
    end: (status: 'success' | 'error') => {
      const duration = (Date.now() - startTime) / 1000;
      hederaTxDuration.observe({ type, status }, duration);
    },
  };
};

export const trackMirrorNodeCall = (endpoint: string) => {
  const startTime = Date.now();
  return {
    end: (status: 'success' | 'error') => {
      const duration = (Date.now() - startTime) / 1000;
      mirrorNodeLatency.observe({ endpoint, status }, duration);
    },
  };
};

export const trackHCSMessage = (topicId: string) => {
  const startTime = Date.now();
  return {
    end: (status: 'success' | 'error') => {
      const duration = (Date.now() - startTime) / 1000;
      hcsMessageLatency.observe({ topic_id: topicId, status }, duration);
    },
  };
};

export const trackInvoiceProcessing = (operation: string) => {
  const startTime = Date.now();
  return {
    end: (status: 'success' | 'error') => {
      const duration = (Date.now() - startTime) / 1000;
      invoiceProcessingDuration.observe({ operation, status }, duration);
    },
  };
};

export const updateWebSocketClients = (count: number) => {
  websocketClientsGauge.set(count);
};

export const trackCacheOperation = (operation: 'hit' | 'miss' | 'set' | 'delete', result: 'success' | 'error') => {
  cacheHitRate.inc({ operation, result });
};

// Extend FastifyRequest interface
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}