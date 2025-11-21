import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { NftModule } from '../nft/nft.module';

@Module({
  imports: [TerminusModule, NftModule],
  controllers: [HealthController],
})
export class HealthModule {}
