import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NftController } from './controllers/nft.controller';
import { NftStorageService } from './services/nft-storage.service';
import { SolanaIndexerService } from './services/solana-indexer.service';
import { EventParserService } from './services/event-parser.service';
import { BuybackSchedulerService } from './services/buyback-sheduler.service';
import { BuybackExecutorService } from './services/buyback-executor.service';
import { BuybackMonitorService } from './services/buyback-monitor.service';
import { JupiterIntegrationService } from './services/jupiter-integration.service';
import { NFT } from './entities/nft.entity';
import { User } from './entities/user.entity';
import { UserLevel } from './entities/user-level.entity';
import { BuybackEvent } from './entities/buyback-event.entity';
import solanaConfig from '../config/solana.config';

@Module({
  imports: [
    ConfigModule.forFeature(solanaConfig),
    TypeOrmModule.forFeature([NFT, User, UserLevel, BuybackEvent]),
  ],
  controllers: [NftController],
  providers: [
    NftStorageService,
    SolanaIndexerService,
    EventParserService,
    BuybackSchedulerService,
    BuybackExecutorService,
    BuybackMonitorService,
    JupiterIntegrationService,
  ],
  exports: [NftStorageService, SolanaIndexerService, BuybackSchedulerService],
})
export class NftModule {}

