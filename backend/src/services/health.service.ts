import { PrismaClient } from '@prisma/client';
import { HederaService } from './hedera';
import { mirrorNodeService } from './mirrorNodeService';
import { FastifyBaseLogger } from 'fastify';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    hedera: ServiceHealth;
    mirrorNode: ServiceHealth;
    fileSystem: ServiceHealth;
  };
  dependencies: {
    external: ExternalDependency[];
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastChecked: string;
  error?: string;
  details?: Record<string, any>;
}

export interface ExternalDependency {
  name: string;
  url: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

export class HealthService {
  private prisma: PrismaClient;
  private hederaService: HederaService;
  private logger: FastifyBaseLogger;
  private startTime: number;

  constructor(
    prisma: PrismaClient,
    hederaService: HederaService,
    logger: FastifyBaseLogger
  ) {
    this.prisma = prisma;
    this.hederaService = hederaService;
    this.logger = logger;
    this.startTime = Date.now();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();

    try {
      // Run all health checks in parallel for better performance
      const [databaseHealth, hederaHealth, mirrorNodeHealth, fileSystemHealth] =
        await Promise.allSettled([
          this.checkDatabase(),
          this.checkHedera(),
          this.checkMirrorNode(),
          this.checkFileSystem(),
        ]);

      const externalDependencies = await this.checkExternalDependencies();

      const services = {
        database: this.getResultValue(databaseHealth),
        hedera: this.getResultValue(hederaHealth),
        mirrorNode: this.getResultValue(mirrorNodeHealth),
        fileSystem: this.getResultValue(fileSystemHealth),
      };

      // Determine overall status
      const overallStatus = this.determineOverallStatus(services, externalDependencies);

      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp,
        uptime,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services,
        dependencies: {
          external: externalDependencies,
        },
        performance: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        },
      };

      this.logger.info(`Health check completed with status: ${overallStatus}`);

      return result;
    } catch (error) {
      this.logger.error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      
      // Test a simple query to ensure database is responsive
      const userCount = await this.prisma.user.count();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          userCount,
          connectionPool: 'active',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Check Hedera service connectivity
   */
  private async checkHedera(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const isConnected = await this.hederaService.isConnected();
      const responseTime = Date.now() - startTime;
      
      if (!isConnected) {
        return {
          status: 'unhealthy',
          responseTime,
          lastChecked: new Date().toISOString(),
          error: 'Hedera service not connected',
        };
      }

      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          network: process.env.HEDERA_NETWORK || 'testnet',
          operatorId: process.env.OPERATOR_ID,
          connected: true,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown Hedera error',
      };
    }
  }

  /**
   * Check Mirror Node API connectivity
   */
  private async checkMirrorNode(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const isHealthy = await mirrorNodeService.healthCheck();
      const responseTime = Date.now() - startTime;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          url: process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
        },
        error: isHealthy ? undefined : 'Mirror Node API not responding',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown Mirror Node error',
      };
    }
  }

  /**
   * Check file system health
   */
  private async checkFileSystem(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Check if upload directory exists and is writable
      const uploadDir = path.join(process.cwd(), 'uploads');
      await fs.access(uploadDir, fs.constants.F_OK | fs.constants.W_OK);
      
      // Check disk space (simplified check)
      const stats = await fs.stat(uploadDir);
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          uploadDirectory: uploadDir,
          accessible: true,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'File system error',
      };
    }
  }

  /**
   * Check external dependencies
   */
  private async checkExternalDependencies(): Promise<ExternalDependency[]> {
    const dependencies = [
      {
        name: 'Hedera Mirror Node',
        url: process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
      },
      {
        name: 'HashScan Explorer',
        url: 'https://hashscan.io',
      },
    ];

    const results = await Promise.allSettled(
      dependencies.map(dep => this.checkExternalService(dep.name, dep.url))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          name: dependencies[index].name,
          url: dependencies[index].url,
          status: 'unhealthy' as const,
          error: 'Failed to check dependency',
        };
      }
    });
  }

  /**
   * Check individual external service
   */
  private async checkExternalService(
    name: string,
    url: string
  ): Promise<ExternalDependency> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${url}/api/v1/network/nodes?limit=1`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      
      return {
        name,
        url,
        status: response.ok ? 'healthy' : 'degraded',
        responseTime,
      };
    } catch (error) {
      return {
        name,
        url,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract result value from Promise.allSettled result
   */
  private getResultValue<T>(result: PromiseSettledResult<T>): T {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Return a default unhealthy status for rejected promises
      return {
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        error: 'Health check failed',
      } as T;
    }
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(
    services: Record<string, ServiceHealth>,
    dependencies: ExternalDependency[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const serviceStatuses = Object.values(services).map(s => s.status);
    const dependencyStatuses = dependencies.map(d => d.status);
    
    const allStatuses = [...serviceStatuses, ...dependencyStatuses];
    
    // If any critical service is unhealthy, system is unhealthy
    if (services.database.status === 'unhealthy' || services.hedera.status === 'unhealthy') {
      return 'unhealthy';
    }
    
    // If any service is unhealthy, system is degraded
    if (allStatuses.includes('unhealthy')) {
      return 'degraded';
    }
    
    // If any service is degraded, system is degraded
    if (allStatuses.includes('degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Get simple health status for load balancers
   */
  async getSimpleHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      // Quick checks for critical services only
      await this.prisma.$queryRaw`SELECT 1`;
      const isHederaConnected = await this.hederaService.isConnected();
      
      if (!isHederaConnected) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
        };
      }
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }
  }
}