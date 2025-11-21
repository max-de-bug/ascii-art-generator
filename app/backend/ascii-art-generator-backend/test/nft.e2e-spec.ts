import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NftStorageService } from '../src/nft/services/nft-storage.service';
import { SolanaIndexerService } from '../src/nft/services/solana-indexer.service';

describe('NFT Controller (e2e)', () => {
  let app: INestApplication;
  let nftStorage: NftStorageService;
  let indexer: SolanaIndexerService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    nftStorage = moduleFixture.get<NftStorageService>(NftStorageService);
    indexer = moduleFixture.get<SolanaIndexerService>(SolanaIndexerService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /nft/indexer/status', () => {
    it('should return indexer status', () => {
      return request(app.getHttpServer())
        .get('/nft/indexer/status')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('isIndexing');
          expect(res.body).toHaveProperty('programId');
          expect(res.body).toHaveProperty('metrics');
        });
    });
  });

  describe('GET /nft/user/:walletAddress', () => {
    const testWallet = '11111111111111111111111111111111';

    it('should return user profile with NFTs and level', async () => {
      // Mock user level
      jest.spyOn(nftStorage, 'getUserLevel').mockResolvedValue({
        walletAddress: testWallet,
        totalMints: 5,
        level: 2,
        experience: 0,
        nextLevelMints: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Mock NFTs
      jest.spyOn(nftStorage, 'getNftsByMinter').mockResolvedValue([
        {
          id: '1',
          mint: 'mint1',
          minter: testWallet,
          name: 'Test NFT 1',
          symbol: 'TEST',
          uri: 'https://ipfs.io/test1',
          transactionSignature: 'sig1',
          slot: 12345,
          timestamp: Date.now(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      return request(app.getHttpServer())
        .get(`/nft/user/${testWallet}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('walletAddress', testWallet);
          expect(res.body).toHaveProperty('nfts');
          expect(res.body).toHaveProperty('userLevel');
          expect(res.body).toHaveProperty('totalNfts');
          expect(Array.isArray(res.body.nfts)).toBe(true);
        });
    });
  });

  describe('GET /nft/user/:walletAddress/level', () => {
    const testWallet = '11111111111111111111111111111111';

    it('should return user level', async () => {
      jest.spyOn(nftStorage, 'getUserLevel').mockResolvedValue({
        walletAddress: testWallet,
        totalMints: 5,
        level: 2,
        experience: 0,
        nextLevelMints: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      return request(app.getHttpServer())
        .get(`/nft/user/${testWallet}/level`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('walletAddress', testWallet);
          expect(res.body).toHaveProperty('level');
          expect(res.body).toHaveProperty('totalMints');
        });
    });
  });

  describe('GET /nft/statistics', () => {
    it('should return statistics', async () => {
      jest.spyOn(nftStorage, 'getStatistics').mockResolvedValue({
        totalNfts: 100,
        totalUsers: 50,
        totalMints: 100,
        buybacks: {
          totalBuybacks: 10,
          totalSolSwapped: 1000,
          totalTokensReceived: 5000000,
        },
      });

      return request(app.getHttpServer())
        .get('/nft/statistics')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalNfts');
          expect(res.body).toHaveProperty('totalUsers');
          expect(res.body).toHaveProperty('buybacks');
        });
    });
  });

  describe('GET /health', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('info');
        });
    });
  });

  describe('GET /health/indexer', () => {
    it('should return indexer health', () => {
      return request(app.getHttpServer())
        .get('/health/indexer')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('indexer');
        });
    });
  });
});
