import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
          db: config.get<number>('redis.db') ?? 0,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          retryStrategy: (times: number) => Math.min(times * 200, 5000),
          lazyConnect: true,
        });
        client.on('error', (err: Error) => {
          console.warn('[Redis] connection error:', err.message);
        });
        client.connect().catch((err: Error) => {
          console.warn('[Redis] initial connect failed:', err.message);
        });
        return client;
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class InfraModule {}

