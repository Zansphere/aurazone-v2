import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  timeAgo,
  slugify,
  buildSku,
  parsePagination,
  calcDiscountPercent,
  generateOrderNumber
} from './index';

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('formats numbers into INR correctly', () => {
      // NOTE: Node.js environments may vary slightly with spaces (NBSP), so we check numeric parts.
      const formatted = formatCurrency(1500);
      expect(formatted).toContain('1,500');
    });
  });

  describe('slugify', () => {
    it('should convert strings to slug', () => {
      expect(slugify('Hello World!')).toBe('hello-world');
      expect(slugify('Some_Weird--Title')).toBe('some-weird-title');
      expect(slugify('  Trim Spaces  ')).toBe('trim-spaces');
    });
  });

  describe('buildSku', () => {
    it('should build a clean SKU from parts', () => {
      expect(buildSku('Nike', 'Air Max', 'XL')).toBe('NIKE-AIRMAX-XL');
      expect(buildSku('Adidas', undefined, 'Black ')).toBe('ADIDAS-BLACK');
    });
  });

  describe('parsePagination', () => {
    it('should parse valid string numbers', () => {
      expect(parsePagination('10', '20')).toEqual({ skip: 10, take: 20 });
    });

    it('should default invalid values to 0 and 10', () => {
      expect(parsePagination('abc', 'def')).toEqual({ skip: 0, take: 10 });
    });

    it('should cap take at maxTake (100)', () => {
      expect(parsePagination(0, 500)).toEqual({ skip: 0, take: 100 });
    });

    it('should calculate skip from page number', () => {
      expect(parsePagination(undefined, 20, 100, 2)).toEqual({ skip: 20, take: 20 });
      expect(parsePagination(undefined, 20, 100, '3')).toEqual({ skip: 40, take: 20 });
      expect(parsePagination({ page: 2, take: 20 })).toEqual({ skip: 20, take: 20 });
    });
  });

  describe('calcDiscountPercent', () => {
    it('should calculate discount correctly', () => {
      expect(calcDiscountPercent(80, 100)).toBe(20);
      expect(calcDiscountPercent(1500, 2000)).toBe(25);
    });

    it('should return 0 if compareAt is less than or equal to price', () => {
      expect(calcDiscountPercent(100, 80)).toBe(0);
      expect(calcDiscountPercent(100, 100)).toBe(0);
    });
  });

  describe('generateOrderNumber', () => {
    it('should generate a string starting with AZ-', () => {
      const orderNo = generateOrderNumber();
      expect(orderNo.startsWith('AZ-')).toBe(true);
      expect(orderNo.split('-').length).toBe(3);
    });
  });

  describe('timeAgo', () => {
    it('should calculate time ago', () => {
      const now = Date.now();
      expect(timeAgo(new Date(now - 1000 * 5))).toBe('just now'); // 5 seconds
      expect(timeAgo(new Date(now - 1000 * 120))).toBe('2 minutes ago'); // 2 minutes
      expect(timeAgo(new Date(now - 1000 * 3600 * 24 * 3))).toBe('3 days ago'); // 3 days
    });
  });
});
