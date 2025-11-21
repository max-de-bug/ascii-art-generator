// Import reflect-metadata before TypeORM entities
import 'reflect-metadata';
import { calculateLevel, LEVEL_CONFIG } from '../../utils/level-calculator';

describe('UserLevel Entity', () => {
  describe('calculateLevel', () => {
    it('should return level 1 for 0 mints', () => {
      const result = calculateLevel(0);
      expect(result.level).toBe(1);
      expect(result.experience).toBe(0);
      expect(result.nextLevelMints).toBe(5);
    });

    it('should return level 1 for 4 mints', () => {
      const result = calculateLevel(4);
      expect(result.level).toBe(1);
      expect(result.experience).toBe(4);
      expect(result.nextLevelMints).toBe(1);
    });

    it('should return level 2 for 5 mints', () => {
      const result = calculateLevel(5);
      expect(result.level).toBe(2);
      expect(result.experience).toBe(0);
      expect(result.nextLevelMints).toBe(5); // Need 5 more for level 3
    });

    it('should return level 2 for 9 mints', () => {
      const result = calculateLevel(9);
      expect(result.level).toBe(2);
      expect(result.experience).toBe(4);
      expect(result.nextLevelMints).toBe(1);
    });

    it('should return level 3 for 10 mints', () => {
      const result = calculateLevel(10);
      expect(result.level).toBe(3);
      expect(result.experience).toBe(0);
      expect(result.nextLevelMints).toBe(10);
    });

    it('should return level 10 for 1000 mints', () => {
      const result = calculateLevel(1000);
      expect(result.level).toBe(10);
      expect(result.experience).toBe(0);
      expect(result.nextLevelMints).toBe(0); // Max level
    });

    it('should return level 10 for 5000 mints (beyond max)', () => {
      const result = calculateLevel(5000);
      expect(result.level).toBe(10);
      expect(result.experience).toBe(4000);
      expect(result.nextLevelMints).toBe(0);
    });

    it('should correctly calculate experience for each level', () => {
      // Level 1: 0-4 mints
      expect(calculateLevel(0).experience).toBe(0);
      expect(calculateLevel(2).experience).toBe(2);
      expect(calculateLevel(4).experience).toBe(4);

      // Level 2: 5-9 mints
      expect(calculateLevel(5).experience).toBe(0);
      expect(calculateLevel(7).experience).toBe(2);
      expect(calculateLevel(9).experience).toBe(4);

      // Level 3: 10-19 mints
      expect(calculateLevel(10).experience).toBe(0);
      expect(calculateLevel(15).experience).toBe(5);
      expect(calculateLevel(19).experience).toBe(9);
    });

    it('should correctly calculate nextLevelMints', () => {
      // At level 1 with 3 mints, need 2 more for level 2
      expect(calculateLevel(3).nextLevelMints).toBe(2);

      // At level 2 with 7 mints, need 3 more for level 3
      expect(calculateLevel(7).nextLevelMints).toBe(3);

      // At level 5 with 50 mints, need 30 more for level 6
      expect(calculateLevel(50).nextLevelMints).toBe(30);
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
    it('should have 10 levels', () => {
      expect(LEVEL_CONFIG.length).toBe(10);
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
    });

    it('should have level 10 at 1000 mints', () => {
      const level10 = LEVEL_CONFIG.find((c) => c.level === 10);
      expect(level10).toBeDefined();
      expect(level10?.mintsRequired).toBe(1000);
    });
  });
});
