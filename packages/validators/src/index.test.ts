import { describe, it, expect } from 'vitest';
import { 
  loginSchema, 
  signupSchema, 
  addressSchema, 
  storeSchema,
  productSchema,
  productVariantSchema
} from './index';

describe('Validators', () => {
  describe('loginSchema', () => {
    it('should validate correct credentials', () => {
      const validData = { email: 'test@example.com', password: 'password123' };
      expect(loginSchema.safeParse(validData).success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = { email: 'testexample.com', password: 'password123' };
      expect(loginSchema.safeParse(invalidData).success).toBe(false);
    });

    it('should reject short password', () => {
      const invalidData = { email: 'test@example.com', password: 'pass' };
      expect(loginSchema.safeParse(invalidData).success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    it('should validate with optional fullName', () => {
      const validData = { email: 'test@example.com', password: 'password123', fullName: 'John Doe' };
      expect(signupSchema.safeParse(validData).success).toBe(true);
    });
    
    it('should validate without fullName', () => {
      const validData = { email: 'test@example.com', password: 'password123' };
      expect(signupSchema.safeParse(validData).success).toBe(true);
    });
  });

  describe('addressSchema', () => {
    it('should validate a full address', () => {
      const address = {
        name: 'Home User',
        phone: '+919876543210',
        addressLine1: '123 Main St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001'
      };
      expect(addressSchema.safeParse(address).success).toBe(true);
    });

    it('should accept 10-digit standard Indian mobile number', () => {
      const address = {
        name: 'Rahul Sharma',
        phone: '9876543210',
        addressLine1: 'Flat 402, Sunshine Heights',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001'
      };
      expect(addressSchema.safeParse(address).success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalidAddress = { name: 'Home' }; // Missing phone, addressLine1, etc.
      expect(addressSchema.safeParse(invalidAddress).success).toBe(false);
    });

    it('should reject excessively long or invalid phone numbers', () => {
      const longPhone = {
        name: 'Rahul Sharma',
        phone: '987654321098765432109876543210',
        addressLine1: '123 Main St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001'
      };
      expect(addressSchema.safeParse(longPhone).success).toBe(false);

      const invalidPhone = {
        ...longPhone,
        phone: 'abcdefghij',
      };
      expect(addressSchema.safeParse(invalidPhone).success).toBe(false);
    });

    it('should reject invalid PIN code formats', () => {
      const invalidPin = {
        name: 'Rahul Sharma',
        phone: '9876543210',
        addressLine1: '123 Main St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '40000112345' // excessively long
      };
      expect(addressSchema.safeParse(invalidPin).success).toBe(false);

      const letterPin = {
        ...invalidPin,
        postalCode: '4000AB'
      };
      expect(addressSchema.safeParse(letterPin).success).toBe(false);
    });

    it('should reject excessively long name or addressLine1', () => {
      const longName = {
        name: 'A'.repeat(80),
        phone: '9876543210',
        addressLine1: '123 Main St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001'
      };
      expect(addressSchema.safeParse(longName).success).toBe(false);

      const longAddr = {
        name: 'Valid Name',
        phone: '9876543210',
        addressLine1: 'A'.repeat(150),
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001'
      };
      expect(addressSchema.safeParse(longAddr).success).toBe(false);
    });
  });

  describe('storeSchema', () => {
    it('should validate valid store data', () => {
      const store = {
        slug: 'my-store-123',
        name: 'My Store',
        isActive: true,
      };
      expect(storeSchema.safeParse(store).success).toBe(true);
    });

    it('should reject invalid slug format', () => {
      const store = { slug: 'My Store!', name: 'My Store' };
      expect(storeSchema.safeParse(store).success).toBe(false);
    });
  });

  describe('productSchema & variants', () => {
    it('should validate valid product with variants', () => {
      const product = {
        storeId: '123e4567-e89b-12d3-a456-426614174000',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Product',
        description: 'Test product description',
        variants: [
          {
            sku: 'SKU-001',
            price: 99.99,
            quantity: 10,
            attributes: [{ key: 'Size', value: 'M' }]
          }
        ]
      };
      expect(productSchema.safeParse(product).success).toBe(true);
    });

    it('should reject product without variants', () => {
      const product = {
        storeId: '123e4567-e89b-12d3-a456-426614174000',
        categoryId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Product',
        description: 'Test product description',
        variants: [] // empty
      };
      expect(productSchema.safeParse(product).success).toBe(false);
    });

    it('should reject variant with negative price', () => {
      const variant = {
        sku: 'SKU-001',
        price: -10, // Invalid
        quantity: 10,
        attributes: []
      };
      expect(productVariantSchema.safeParse(variant).success).toBe(false);
    });
  });
});
