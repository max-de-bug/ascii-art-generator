"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const request = __importStar(require("supertest"));
const app_module_1 = require("../src/app.module");
const nft_storage_service_1 = require("../src/nft/services/nft-storage.service");
const solana_indexer_service_1 = require("../src/nft/services/solana-indexer.service");
describe('NFT Controller (e2e)', () => {
    let app;
    let nftStorage;
    let indexer;
    beforeAll(async () => {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        nftStorage = moduleFixture.get(nft_storage_service_1.NftStorageService);
        indexer = moduleFixture.get(solana_indexer_service_1.SolanaIndexerService);
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
            jest.spyOn(nftStorage, 'getUserLevel').mockResolvedValue({
                walletAddress: testWallet,
                totalMints: 5,
                level: 2,
                experience: 0,
                nextLevelMints: 5,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
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
            ]);
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
            });
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
//# sourceMappingURL=nft.e2e-spec.js.map