import Fastify, { FastifyInstance } from 'fastify';
import { build as buildApp } from '../../src/app';

export interface TestAppOptions {
  logger?: boolean;
}

export async function build(opts: TestAppOptions = {}): Promise<FastifyInstance> {
  return await buildApp({
    logger: opts.logger ?? false
  });
}