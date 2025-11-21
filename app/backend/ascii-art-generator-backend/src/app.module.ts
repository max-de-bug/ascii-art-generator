import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  ThrottlerModule,
  ThrottlerGuard,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import solanaConfig from './config/solana.config';
import buybackConfig from './config/buyback.config';
import throttlerConfig from './config/throttler.config';
import { validationSchema } from './config/validation.schema';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NFT } from './nft/entities/nft.entity';
import { User } from './nft/entities/user.entity';
import { UserLevel } from './nft/entities/user-level.entity';
import { BuybackEvent } from './nft/entities/buyback-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [solanaConfig, buybackConfig, throttlerConfig],
      envFilePath: ['.env.local', '.env'],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ThrottlerModuleOptions => {
        return {
          throttlers: [
            {
              ttl: configService.get<number>('throttler.ttl', 60) * 1000, // Convert to milliseconds
              limit: configService.get<number>('throttler.limit', 100),
            },
          ],
        };
      },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [NFT, User, UserLevel, BuybackEvent],
      synchronize: false,
      ssl: {
        rejectUnauthorized: false,
      },
    }),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
