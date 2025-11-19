// Import reflect-metadata before TypeORM
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NftStorageService } from '../nft-storage.service';
import { NFT } from '../../entities/nft.entity';
import { UserLevel } from '../../entities/user-level.entity';
import { BuybackEvent } from '../../entities/buyback-event.entity';

describe('NftStorageService', () => {
  let service: NftStorageService;
  let nftRepository: Repository<NFT>;
  let userLevelRepository: Repository<UserLevel>;
  let buybackEventRepository: Repository<BuybackEvent>;

  const mockNftRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockUserLevelRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockBuybackEventRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NftStorageService,
        {
          provide: getRepositoryToken(NFT),
          useValue: mockNftRepository,
        },
        {
          provide: getRepositoryToken(UserLevel),
          useValue: mockUserLevelRepository,
        },
        {
          provide: getRepositoryToken(BuybackEvent),
          useValue: mockBuybackEventRepository,
        },
      ],
    }).compile();

    service = module.get<NftStorageService>(NftStorageService);
    nftRepository = module.get<Repository<NFT>>(getRepositoryToken(NFT));
    userLevelRepository = module.get<Repository<UserLevel>>(
      getRepositoryToken(UserLevel),
    );
    buybackEventRepository = module.get<Repository<BuybackEvent>>(
      getRepositoryToken(BuybackEvent),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveNft', () => {
    it('should save a new NFT', async () => {
      const nftData: Partial<NFT> = {
        mint: 'testMint123',
        minter: 'testMinter123',
        name: 'Test NFT',
        symbol: 'TEST',
        uri: 'https://ipfs.io/test',
        transactionSignature: 'testSig123',
        slot: 12345,
        timestamp: Date.now(),
      };

      mockNftRepository.findOne.mockResolvedValue(null);
      mockNftRepository.save.mockResolvedValue({ ...nftData, id: 'uuid' });
      mockNftRepository.count.mockResolvedValue(1);
      mockUserLevelRepository.findOne.mockResolvedValue(null);
      mockUserLevelRepository.create.mockReturnValue({
        walletAddress: 'testMinter123',
        totalMints: 1,
        level: 1,
        experience: 1,
        nextLevelMints: 4,
      });
      mockUserLevelRepository.save.mockResolvedValue({
        walletAddress: 'testMinter123',
        totalMints: 1,
        level: 1,
      });

      const result = await service.saveNft(nftData);

      expect(mockNftRepository.findOne).toHaveBeenCalledWith({
        where: { mint: nftData.mint },
      });
      expect(mockNftRepository.save).toHaveBeenCalledWith(nftData);
      expect(result).toBeDefined();
    });

    it('should return existing NFT if already exists', async () => {
      const existingNft = {
        id: 'uuid',
        mint: 'testMint123',
        minter: 'testMinter123',
      };

      mockNftRepository.findOne.mockResolvedValue(existingNft);

      const result = await service.saveNft({
        mint: 'testMint123',
        minter: 'testMinter123',
      });

      expect(mockNftRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(existingNft);
    });

    it('should throw error if mint is missing', async () => {
      await expect(service.saveNft({ minter: 'test' })).rejects.toThrow(
        'NFT mint address is required',
      );
    });
  });

  describe('getUserLevel', () => {
    it('should return existing user level', async () => {
      const userLevel = {
        walletAddress: 'test123',
        totalMints: 5,
        level: 2,
        experience: 0,
        nextLevelMints: 5,
      };

      mockUserLevelRepository.findOne.mockResolvedValue(userLevel);

      const result = await service.getUserLevel('test123');

      expect(result).toEqual(userLevel);
    });

    it('should create new user level if not exists', async () => {
      mockUserLevelRepository.findOne.mockResolvedValue(null);
      mockNftRepository.count.mockResolvedValue(3);
      mockUserLevelRepository.create.mockReturnValue({
        walletAddress: 'test123',
        totalMints: 3,
        level: 1,
        experience: 3,
        nextLevelMints: 2,
      });
      mockUserLevelRepository.save.mockResolvedValue({
        walletAddress: 'test123',
        totalMints: 3,
        level: 1,
      });

      const result = await service.getUserLevel('test123');

      expect(mockNftRepository.count).toHaveBeenCalledWith({
        where: { minter: 'test123' },
      });
      expect(mockUserLevelRepository.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('isTransactionProcessed', () => {
    it('should return true if NFT exists with signature', async () => {
      mockNftRepository.count.mockResolvedValue(1);
      mockBuybackEventRepository.count.mockResolvedValue(0);

      const result = await service.isTransactionProcessed('testSig123');

      expect(result).toBe(true);
    });

    it('should return true if BuybackEvent exists with signature', async () => {
      mockNftRepository.count.mockResolvedValue(0);
      mockBuybackEventRepository.count.mockResolvedValue(1);

      const result = await service.isTransactionProcessed('testSig123');

      expect(result).toBe(true);
    });

    it('should return false if neither exists', async () => {
      mockNftRepository.count.mockResolvedValue(0);
      mockBuybackEventRepository.count.mockResolvedValue(0);

      const result = await service.isTransactionProcessed('testSig123');

      expect(result).toBe(false);
    });
  });

  describe('saveBuybackEvent', () => {
    it('should save a new buyback event', async () => {
      const buybackData: Partial<BuybackEvent> = {
        transactionSignature: 'testSig123',
        amountSol: 1000000000,
        tokenAmount: 5000000,
        timestamp: Date.now(),
        slot: 12345,
      };

      mockBuybackEventRepository.findOne.mockResolvedValue(null);
      mockBuybackEventRepository.save.mockResolvedValue({
        ...buybackData,
        id: 'uuid',
      });

      const result = await service.saveBuybackEvent(buybackData);

      expect(mockBuybackEventRepository.save).toHaveBeenCalledWith(buybackData);
      expect(result).toBeDefined();
    });

    it('should throw error if transactionSignature is missing', async () => {
      await expect(
        service.saveBuybackEvent({ amountSol: 1000 }),
      ).rejects.toThrow('Buyback event transaction signature is required');
    });
  });
});

