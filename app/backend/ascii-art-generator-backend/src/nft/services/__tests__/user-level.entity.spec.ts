// Import reflect-metadata before TypeORM entities
import 'reflect-metadata';
import { calculateLevel, LEVEL_CONFIG } from '../../utils/level-calculator';

describe('UserLevel Entity', () => {
  describe('calculateLevel', () => {
    it('should return level 1 for 0 mints', () => {
      const result = calculateLevel(0);
      expect(result.level).toBe(1);
      expect(result.name).toBe('Bronze I');
      expect(result.tier).toBe('Bronze');
      expect(result.experience).toBe(0);
      expect(result.nextLevelMints).toBe(5);
    });

    it('should return level 1 for 3 mints', () => {
      const result = calculateLevel(3);
      expect(result.level).toBe(1);
      expect(result.name).toBe('Bronze I');
      expect(result.tier).toBe('Bronze');
      expect(result.experience).toBe(3);
      expect(result.nextLevelMints).toBe(2);
    });

    it('should return level 2 for 5 mints', () => {
      const result = calculateLevel(5);
      expect(result.level).toBe(2);
      expect(result.name).toBe('Bronze II');
      expect(result.tier).toBe('Bronze');
      expect(result.experience).toBe(0);
      expect(result.nextLevelMints).toBe(7); // Need 7 more for level 3
    });

    it('should return level 6 for 50 mints (Silver tier)', () => {
      const result = calculateLevel(50);
      expect(result.level).toBe(6);
      expect(result.name).toBe('Silver I');
      expect(result.tier).toBe('Silver');
      expect(result.experience).toBe(0);
      expect(result.nextLevelMints).toBe(20);
    });

    it('should return level 40 (Zenith V) for 5710+ mints', () => {
      const result = calculateLevel(5710);
      expect(result.level).toBe(40);
      expect(result.name).toBe('Zenith V');
      expect(result.tier).toBe('Zenith');
      expect(result.experience).toBe(0);
      expect(result.nextLevelMints).toBe(0); // Max level
    });

    it('should return level 40 for 10000 mints (beyond max)', () => {
      const result = calculateLevel(10000);
      expect(result.level).toBe(40);
      expect(result.name).toBe('Zenith V');
      expect(result.tier).toBe('Zenith');
      expect(result.experience).toBe(4290);
      expect(result.nextLevelMints).toBe(0);
    });

    it('should correctly calculate experience for each level', () => {
      // Level 1: 0-4 mints
      expect(calculateLevel(0).experience).toBe(0);
      expect(calculateLevel(2).experience).toBe(2);
      expect(calculateLevel(4).experience).toBe(4);

      // Level 2: 5-11 mints
      expect(calculateLevel(5).experience).toBe(0);
      expect(calculateLevel(8).experience).toBe(3);
      expect(calculateLevel(11).experience).toBe(6);

      // Level 3: 12-21 mints
      expect(calculateLevel(12).experience).toBe(0);
      expect(calculateLevel(15).experience).toBe(3);
      expect(calculateLevel(21).experience).toBe(9);
    });

    it('should correctly calculate nextLevelMints', () => {
      // At level 1 with 3 mints, need 2 more for level 2
      expect(calculateLevel(3).nextLevelMints).toBe(2);

      // At level 2 with 8 mints, need 4 more for level 3
      expect(calculateLevel(8).nextLevelMints).toBe(4);

      // At level 11 (Gold I) with 220 mints, need 30 more for level 12
      expect(calculateLevel(220).nextLevelMints).toBe(30);
    });

    it('should indicate tier changes', () => {
      // Level 5 (Bronze V) -> Level 6 (Silver I) should show tier change
      const result = calculateLevel(35);
      expect(result.level).toBe(5);
      expect(result.tier).toBe('Bronze');
      expect(result.nextTier).toBe('Silver');
    });

    it('should handle all level boundaries correctly', () => {
      LEVEL_CONFIG.forEach((config, index) => {
        const result = calculateLevel(config.mintsRequired);
        expect(result.level).toBe(config.level);

        // Check next level requirement
        if (index < LEVEL_CONFIG.length - 1) {
          const nextConfig = LEVEL_CONFIG[index + 1];
          expect(result.nextLevelMints).toBe(
            nextConfig.mintsRequired - config.mintsRequired,
          );
        }
      });
    });
  });

  describe('LEVEL_CONFIG', () => {
    it('should have 40 levels', () => {
      expect(LEVEL_CONFIG.length).toBe(40);
    });

    it('should have increasing mintsRequired', () => {
      for (let i = 1; i < LEVEL_CONFIG.length; i++) {
        expect(LEVEL_CONFIG[i].mintsRequired).toBeGreaterThan(
          LEVEL_CONFIG[i - 1].mintsRequired,
        );
      }
    });

    it('should have level 1 starting at 0', () => {
      expect(LEVEL_CONFIG[0].mintsRequired).toBe(0);
      expect(LEVEL_CONFIG[0].level).toBe(1);
      expect(LEVEL_CONFIG[0].name).toBe('Bronze I');
      expect(LEVEL_CONFIG[0].tier).toBe('Bronze');
    });

    it('should have level 40 (Zenith V) at 5710 mints', () => {
      const level40 = LEVEL_CONFIG.find((c) => c.level === 40);
      expect(level40).toBeDefined();
      expect(level40?.mintsRequired).toBe(5710);
      expect(level40?.name).toBe('Zenith V');
      expect(level40?.tier).toBe('Zenith');
    });

    it('should have all tiers properly defined', () => {
      const tiers = new Set(LEVEL_CONFIG.map((c) => c.tier));
      expect(tiers.has('Bronze')).toBe(true);
      expect(tiers.has('Silver')).toBe(true);
      expect(tiers.has('Gold')).toBe(true);
      expect(tiers.has('Platinum')).toBe(true);
      expect(tiers.has('Diamond')).toBe(true);
      expect(tiers.has('Master')).toBe(true);
      expect(tiers.has('Grandmaster')).toBe(true);
      expect(tiers.has('Zenith')).toBe(true);
    });
  });
});
