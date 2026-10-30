import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateOrderNumber(): string {
  const prefix = 'AZ';
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

function randomDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d;
}

async function main() {
  console.log('🌱 Seeding database (comprehensive)...\n');

  // ═══════════════════════════════════════════════════════════════
  //  CLEAN
  // ═══════════════════════════════════════════════════════════════
  console.log('Clearing existing data...');
  await prisma.notificationHistory.deleteMany({});
  await prisma.notificationPreferences.deleteMany({});
  await prisma.shipmentLog.deleteMany({});
  await prisma.paymentLog.deleteMany({});
  await prisma.orderLog.deleteMany({});
  await prisma.orderStatusEmailLog.deleteMany({});
  await prisma.orderShipment.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.orderAddress.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.inventoryLog.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.wishlist.deleteMany({});
  await prisma.adminAuditLog.deleteMany({});
  await prisma.storefrontSection.deleteMany({});
  await prisma.productReview.deleteMany({});
  await prisma.productVariantAttribute.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.attributeTemplate.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.storeManager.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.userSession.deleteMany({});
  await prisma.otpVerification.deleteMany({});
  await prisma.pushSubscription.deleteMany({});
  await prisma.guestSession.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('✓ Cleared.\n');

  // ═══════════════════════════════════════════════════════════════
  //  USERS
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating users...');
  const adminPw = await bcrypt.hash('Admin@123', 10);
  const customerPw = await bcrypt.hash('Customer@123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@aurazone.com', password: adminPw, fullName: 'AuraZone Admin',
      role: 'SUPER_ADMIN', isActive: true, isEmailVerified: new Date(), isGuest: false,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@aurazone.com', password: adminPw, fullName: 'Store Manager',
      role: 'STORE_MANAGER', isActive: true, isEmailVerified: new Date(), isGuest: false,
    },
  });

  const customerNames = [
    'Arjun Patel', 'Priya Sharma', 'Rahul Kumar', 'Neha Singh', 'Vikram Reddy',
    'Ananya Gupta', 'Karthik Nair', 'Divya Menon', 'Amit Joshi', 'Sanjana Rao',
    'Rohan Verma', 'Meera Iyer',
  ];

  const customers: Array<{ id: string; email: string; fullName: string }> = [];
  for (let i = 0; i < customerNames.length; i++) {
    const name = customerNames[i];
    const emailSlug = name.toLowerCase().replace(/\s+/g, '.');
    const c = await prisma.user.create({
      data: {
        email: `${emailSlug}@example.com`,
        password: customerPw,
        fullName: name,
        phone: `+91 ${9800000000 + i}`,
        role: 'CUSTOMER',
        isActive: true,
        isEmailVerified: i < 10 ? new Date() : null,
        isGuest: false,
        lastLoginAt: randomDate(7),
        createdAt: randomDate(90),
      },
    });
    customers.push({ id: c.id, email: c.email!, fullName: c.fullName! });
  }
  console.log(`✓ Created ${customerNames.length + 2} users.\n`);

  // ═══════════════════════════════════════════════════════════════
  //  ADDRESSES (for orders)
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating addresses...');
  const addressData = [
    { city: 'Mumbai', state: 'Maharashtra', postalCode: '400001' },
    { city: 'Bengaluru', state: 'Karnataka', postalCode: '560001' },
    { city: 'Delhi', state: 'Delhi', postalCode: '110001' },
    { city: 'Hyderabad', state: 'Telangana', postalCode: '500001' },
    { city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001' },
    { city: 'Pune', state: 'Maharashtra', postalCode: '411001' },
  ];

  for (let i = 0; i < customers.length; i++) {
    const addr = addressData[i % addressData.length];
    await prisma.address.create({
      data: {
        userId: customers[i].id,
        name: customers[i].fullName,
        phone: `+91 ${9800000000 + i}`,
        addressLine1: `${100 + i}, MG Road`,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        isDefault: true,
      },
    });
  }
  console.log('✓ Addresses created.\n');

  // ═══════════════════════════════════════════════════════════════
  //  STORES
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating stores...');
  const storesData = [
    { name: 'Aura Fashion', slug: 'fashion', description: 'Trendy apparel and accessories for men and women. Premium quality fabrics with modern designs.', accentColor: '#3B82F6', logoUrl: 'https://ui-avatars.com/api/?name=AF&background=3B82F6&color=fff&size=128', sortOrder: 1 },
    { name: 'Aura Shoes', slug: 'shoes', description: 'Premium footwear for all occasions — sneakers, formals, and sports shoes.', accentColor: '#10B981', logoUrl: 'https://ui-avatars.com/api/?name=AS&background=10B981&color=fff&size=128', sortOrder: 2 },
    { name: 'Aura Cosmetics', slug: 'cosmetics', description: 'Beauty and skincare products from top brands. Makeup, fragrances, and grooming essentials.', accentColor: '#EC4899', logoUrl: 'https://ui-avatars.com/api/?name=AC&background=EC4899&color=fff&size=128', sortOrder: 3 },
    { name: 'Aura Home', slug: 'home', description: 'Home decor, furnishings, and essential items for modern living.', accentColor: '#F59E0B', logoUrl: 'https://ui-avatars.com/api/?name=AH&background=F59E0B&color=fff&size=128', sortOrder: 4 },
    { name: 'Aura Electronics', slug: 'electronics', description: 'Gadgets, accessories, and smart devices for the tech-savvy.', accentColor: '#8B5CF6', logoUrl: 'https://ui-avatars.com/api/?name=AE&background=8B5CF6&color=fff&size=128', sortOrder: 5 },
  ];

  const stores: any[] = [];
  for (const s of storesData) {
    const store = await prisma.store.create({ data: { ...s, isActive: true } });
    stores.push(store);
  }

  // Assign manager to first two stores
  await prisma.storeManager.create({ data: { userId: manager.id, storeId: stores[0].id } });
  await prisma.storeManager.create({ data: { userId: manager.id, storeId: stores[1].id } });
  console.log('✓ 5 stores created.\n');

  // ═══════════════════════════════════════════════════════════════
  //  CATEGORIES (per store)
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating categories...');
  const catMap: Record<string, any[]> = {};

  // Fashion store categories
  const fashionCats = [
    { name: 'T-Shirts', slug: 'tshirts', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=400' },
    { name: 'Shirts', slug: 'shirts', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=400' },
    { name: 'Jeans', slug: 'jeans', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=400' },
    { name: 'Jackets', slug: 'jackets', sortOrder: 4, imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400' },
    { name: 'Accessories', slug: 'fashion-accessories', sortOrder: 5, imageUrl: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=400' },
  ];
  catMap['fashion'] = [];
  for (const c of fashionCats) {
    const cat = await prisma.category.create({ data: { ...c, storeId: stores[0].id, isActive: true } });
    catMap['fashion'].push(cat);
  }

  // Shoes store categories
  const shoesCats = [
    { name: 'Sneakers', slug: 'sneakers', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=400' },
    { name: 'Formal Shoes', slug: 'formal-shoes', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?q=80&w=400' },
    { name: 'Sports Shoes', slug: 'sports-shoes', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=400' },
    { name: 'Sandals', slug: 'sandals', sortOrder: 4, imageUrl: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?q=80&w=400' },
  ];
  catMap['shoes'] = [];
  for (const c of shoesCats) {
    const cat = await prisma.category.create({ data: { ...c, storeId: stores[1].id, isActive: true } });
    catMap['shoes'].push(cat);
  }

  // Cosmetics store categories
  const cosmeticsCats = [
    { name: 'Skincare', slug: 'skincare', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=400' },
    { name: 'Makeup', slug: 'makeup', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?q=80&w=400' },
    { name: 'Fragrances', slug: 'fragrances', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=400' },
  ];
  catMap['cosmetics'] = [];
  for (const c of cosmeticsCats) {
    const cat = await prisma.category.create({ data: { ...c, storeId: stores[2].id, isActive: true } });
    catMap['cosmetics'].push(cat);
  }

  // Home store categories
  const homeCats = [
    { name: 'Furniture', slug: 'furniture', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=400' },
    { name: 'Decor', slug: 'decor', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=400' },
    { name: 'Lighting', slug: 'lighting', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1760977817633-86910d0dfe3d?q=80&w=1081&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D' },
  ];
  catMap['home'] = [];
  for (const c of homeCats) {
    const cat = await prisma.category.create({ data: { ...c, storeId: stores[3].id, isActive: true } });
    catMap['home'].push(cat);
  }

  // Electronics store categories
  const elecCats = [
    { name: 'Earbuds & Headphones', slug: 'earbuds', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400' },
    { name: 'Phone Cases', slug: 'phone-cases', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=400' },
    { name: 'Smart Watches', slug: 'smart-watches', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D' },
  ];
  catMap['electronics'] = [];
  for (const c of elecCats) {
    const cat = await prisma.category.create({ data: { ...c, storeId: stores[4].id, isActive: true } });
    catMap['electronics'].push(cat);
  }

  const totalCats = Object.values(catMap).flat().length;
  console.log(`✓ ${totalCats} categories created.\n`);

  // ═══════════════════════════════════════════════════════════════
  //  ATTRIBUTE TEMPLATES
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating attribute templates...');
  // Fashion store
  await prisma.attributeTemplate.createMany({
    data: [
      { storeId: stores[0].id, name: 'Size', key: 'size', fieldType: 'SELECT', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], isVariant: true, isRequired: true, isFilterable: true, sortOrder: 1 },
      { storeId: stores[0].id, name: 'Color', key: 'color', fieldType: 'COLOR_PICKER', isVariant: true, isRequired: true, isFilterable: true, sortOrder: 2 },
      { storeId: stores[0].id, name: 'Material', key: 'material', fieldType: 'SELECT', options: ['Cotton', 'Polyester', 'Linen', 'Denim', 'Silk'], isVariant: false, isRequired: false, isFilterable: true, sortOrder: 3 },
    ],
  });
  // Shoes store
  await prisma.attributeTemplate.createMany({
    data: [
      { storeId: stores[1].id, name: 'Size (UK)', key: 'size', fieldType: 'SELECT', options: ['6', '7', '8', '9', '10', '11', '12'], isVariant: true, isRequired: true, isFilterable: true, sortOrder: 1 },
      { storeId: stores[1].id, name: 'Color', key: 'color', fieldType: 'COLOR_PICKER', isVariant: true, isRequired: true, isFilterable: true, sortOrder: 2 },
    ],
  });
  // Electronics
  await prisma.attributeTemplate.createMany({
    data: [
      { storeId: stores[4].id, name: 'Color', key: 'color', fieldType: 'SELECT', options: ['Black', 'White', 'Blue', 'Red', 'Green'], isVariant: true, isRequired: true, isFilterable: true, sortOrder: 1 },
      { storeId: stores[4].id, name: 'Warranty', key: 'warranty', fieldType: 'SELECT', options: ['6 months', '1 year', '2 years'], isVariant: false, isRequired: false, isFilterable: false, sortOrder: 2 },
    ],
  });
  console.log('✓ Attribute templates created.\n');

  // ═══════════════════════════════════════════════════════════════
  //  PRODUCTS (with variants & inventory)
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating products...');

  interface ProductSeed {
    name: string; slug: string; description: string; storeIdx: number; catSlug: string;
    brand?: string; isFeatured?: boolean; tags?: string[];
    variants: Array<{
      sku: string; price: number; compareAtPrice?: number; qty: number;
      attrs: Array<{ key: string; value: string }>;
      imageUrl: string; imageAlt: string;
    }>;
  }

  const productSeeds: ProductSeed[] = [
    // Fashion T-Shirts
    {
      name: 'Classic White T-Shirt', slug: 'classic-white-tshirt', description: 'A comfortable and versatile classic white t-shirt made from 100% premium cotton.', storeIdx: 0, catSlug: 'tshirts', brand: 'Aura Basics', isFeatured: true, tags: ['cotton', 'basic', 'summer'],
      variants: [
        { sku: 'FASH-TS-W-M', price: 799, compareAtPrice: 999, qty: 100, attrs: [{ key: 'Size', value: 'M' }, { key: 'Color', value: '#FFFFFF' }], imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600', imageAlt: 'White T-Shirt M' },
        { sku: 'FASH-TS-W-L', price: 799, compareAtPrice: 999, qty: 75, attrs: [{ key: 'Size', value: 'L' }, { key: 'Color', value: '#FFFFFF' }], imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600', imageAlt: 'White T-Shirt L' },
        { sku: 'FASH-TS-B-M', price: 899, compareAtPrice: 1099, qty: 60, attrs: [{ key: 'Size', value: 'M' }, { key: 'Color', value: '#000000' }], imageUrl: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?q=80&w=600', imageAlt: 'Black T-Shirt M' },
      ],
    },
    {
      name: 'Oversized Graphic Tee', slug: 'oversized-graphic-tee', description: 'Streetwear-inspired oversized tee with bold graphic print.', storeIdx: 0, catSlug: 'tshirts', brand: 'UrbanEdge', tags: ['graphic', 'streetwear', 'oversized'],
      variants: [
        { sku: 'FASH-GT-G-L', price: 1299, compareAtPrice: 1599, qty: 45, attrs: [{ key: 'Size', value: 'L' }, { key: 'Color', value: '#4B5563' }], imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=600', imageAlt: 'Graphic Tee' },
        { sku: 'FASH-GT-G-XL', price: 1299, compareAtPrice: 1599, qty: 30, attrs: [{ key: 'Size', value: 'XL' }, { key: 'Color', value: '#4B5563' }], imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=600', imageAlt: 'Graphic Tee XL' },
      ],
    },
    // Fashion Jeans
    {
      name: 'Slim Fit Denim Jeans', slug: 'slim-fit-denim-jeans', description: 'Premium quality slim fit blue denim jeans with stretch comfort.', storeIdx: 0, catSlug: 'jeans', brand: 'DenimCo', isFeatured: true, tags: ['denim', 'slim-fit', 'premium'],
      variants: [
        { sku: 'FASH-JN-B-32', price: 1999, compareAtPrice: 2499, qty: 40, attrs: [{ key: 'Size', value: '32' }, { key: 'Color', value: '#1E3A5F' }], imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=600', imageAlt: 'Blue Jeans 32' },
        { sku: 'FASH-JN-B-34', price: 1999, compareAtPrice: 2499, qty: 25, attrs: [{ key: 'Size', value: '34' }, { key: 'Color', value: '#1E3A5F' }], imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=600', imageAlt: 'Blue Jeans 34' },
      ],
    },
    // Fashion Jackets
    {
      name: 'Leather Biker Jacket', slug: 'leather-biker-jacket', description: 'Classic leather biker jacket with quilted lining and silver hardware.', storeIdx: 0, catSlug: 'jackets', brand: 'MotoEdge', isFeatured: true, tags: ['leather', 'biker', 'winter'],
      variants: [
        { sku: 'FASH-JK-BK-L', price: 5999, compareAtPrice: 7999, qty: 15, attrs: [{ key: 'Size', value: 'L' }, { key: 'Color', value: '#1C1C1C' }], imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600', imageAlt: 'Leather Jacket' },
      ],
    },
    // Shoes Sneakers
    {
      name: 'Pro Running Sneakers', slug: 'pro-running-sneakers', description: 'Lightweight and durable running shoes with responsive cushioning for everyday training.', storeIdx: 1, catSlug: 'sneakers', brand: 'AuraRun', isFeatured: true, tags: ['running', 'lightweight', 'sports'],
      variants: [
        { sku: 'SHOE-RN-B-9', price: 3499, compareAtPrice: 4999, qty: 20, attrs: [{ key: 'Size (UK)', value: '9' }, { key: 'Color', value: '#111827' }], imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600', imageAlt: 'Running Sneakers 9' },
        { sku: 'SHOE-RN-B-10', price: 3499, compareAtPrice: 4999, qty: 18, attrs: [{ key: 'Size (UK)', value: '10' }, { key: 'Color', value: '#111827' }], imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600', imageAlt: 'Running Sneakers 10' },
        { sku: 'SHOE-RN-W-9', price: 3499, compareAtPrice: 4999, qty: 12, attrs: [{ key: 'Size (UK)', value: '9' }, { key: 'Color', value: '#F3F4F6' }], imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=600', imageAlt: 'White Sneakers 9' },
      ],
    },
    {
      name: 'Classic Leather Oxfords', slug: 'classic-leather-oxfords', description: 'Handcrafted leather oxford shoes for the modern gentleman.', storeIdx: 1, catSlug: 'formal-shoes', brand: 'Gentlemen\'s Co', tags: ['formal', 'leather', 'office'],
      variants: [
        { sku: 'SHOE-OX-BR-8', price: 4599, compareAtPrice: 5999, qty: 10, attrs: [{ key: 'Size (UK)', value: '8' }, { key: 'Color', value: '#8B4513' }], imageUrl: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?q=80&w=600', imageAlt: 'Brown Oxfords' },
      ],
    },
    // Cosmetics
    {
      name: 'Hydrating Face Serum', slug: 'hydrating-face-serum', description: 'Vitamin C + Hyaluronic Acid serum for glowing, hydrated skin.', storeIdx: 2, catSlug: 'skincare', brand: 'GlowLab', isFeatured: true, tags: ['serum', 'vitamin-c', 'hydration'],
      variants: [
        { sku: 'COS-SRM-30', price: 1299, compareAtPrice: 1799, qty: 80, attrs: [{ key: 'Size', value: '30ml' }], imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=600', imageAlt: 'Face Serum 30ml' },
        { sku: 'COS-SRM-50', price: 1899, compareAtPrice: 2499, qty: 45, attrs: [{ key: 'Size', value: '50ml' }], imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=600', imageAlt: 'Face Serum 50ml' },
      ],
    },
    {
      name: 'Matte Lipstick Set', slug: 'matte-lipstick-set', description: 'Collection of 6 long-lasting matte lipstick shades.', storeIdx: 2, catSlug: 'makeup', brand: 'AuraGlam', tags: ['lipstick', 'matte', 'gift-set'],
      variants: [
        { sku: 'COS-LIP-6PK', price: 999, compareAtPrice: 1499, qty: 55, attrs: [{ key: 'Color', value: 'Assorted' }], imageUrl: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?q=80&w=600', imageAlt: 'Lipstick Set' },
      ],
    },
    // Home
    {
      name: 'Scandinavian Table Lamp', slug: 'scandinavian-table-lamp', description: 'Minimalist wooden table lamp with fabric shade. Perfect for bedside or desk.', storeIdx: 3, catSlug: 'lighting', brand: 'NordicHome', tags: ['lamp', 'minimalist', 'wooden'],
      variants: [
        { sku: 'HOME-LAMP-W', price: 2499, compareAtPrice: 3299, qty: 20, attrs: [{ key: 'Color', value: 'Warm White' }], imageUrl: 'https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D', imageAlt: 'Table Lamp' },
      ],
    },
    {
      name: 'Velvet Throw Cushion', slug: 'velvet-throw-cushion', description: 'Luxurious velvet throw cushion covers — set of 2.', storeIdx: 3, catSlug: 'decor', brand: 'CozyNest', tags: ['cushion', 'velvet', 'decor'],
      variants: [
        { sku: 'HOME-CSH-EM', price: 899, compareAtPrice: 1199, qty: 65, attrs: [{ key: 'Color', value: 'Emerald' }], imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=600', imageAlt: 'Velvet Cushion' },
        { sku: 'HOME-CSH-NV', price: 899, compareAtPrice: 1199, qty: 50, attrs: [{ key: 'Color', value: 'Navy' }], imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=600', imageAlt: 'Navy Cushion' },
      ],
    },
    // Electronics
    {
      name: 'AuraBuds Pro', slug: 'aurabuds-pro', description: 'True wireless earbuds with active noise cancellation, 30h battery life.', storeIdx: 4, catSlug: 'earbuds', brand: 'AuraAudio', isFeatured: true, tags: ['tws', 'anc', 'bluetooth'],
      variants: [
        { sku: 'ELEC-BUD-BK', price: 2999, compareAtPrice: 4499, qty: 35, attrs: [{ key: 'Color', value: 'Black' }], imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600', imageAlt: 'AuraBuds Black' },
        { sku: 'ELEC-BUD-WH', price: 2999, compareAtPrice: 4499, qty: 28, attrs: [{ key: 'Color', value: 'White' }], imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600', imageAlt: 'AuraBuds White' },
      ],
    },
    {
      name: 'AuraWatch Fit', slug: 'aurawatch-fit', description: 'Fitness smartwatch with heart rate, SpO2, GPS, and 14-day battery.', storeIdx: 4, catSlug: 'smart-watches', brand: 'AuraTech', isFeatured: true, tags: ['smartwatch', 'fitness', 'gps'],
      variants: [
        { sku: 'ELEC-WCH-BK', price: 4999, compareAtPrice: 6999, qty: 22, attrs: [{ key: 'Color', value: 'Black' }], imageUrl: 'https://images.unsplash.com/photo-1760977817633-86910d0dfe3d?q=80&w=1081&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D', imageAlt: 'AuraWatch Black' },
        { sku: 'ELEC-WCH-BL', price: 4999, compareAtPrice: 6999, qty: 15, attrs: [{ key: 'Color', value: 'Blue' }], imageUrl: 'https://images.unsplash.com/photo-1760977817633-86910d0dfe3d?q=80&w=1081&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D', imageAlt: 'AuraWatch Blue' },
      ],
    },
  ];

  const createdProducts: Array<{ id: string; name: string; storeIdx: number; variants: Array<{ id: string; sku: string; price: number }> }> = [];
  const allCategories = Object.values(catMap).flat();

  for (const ps of productSeeds) {
    const store = stores[ps.storeIdx];
    const category = allCategories.find(c => c.slug === ps.catSlug)!;

    const product = await prisma.product.create({
      data: {
        name: ps.name,
        slug: ps.slug,
        description: ps.description,
        storeId: store.id,
        categoryId: category.id,
        brand: ps.brand,
        isActive: true,
        isFeatured: ps.isFeatured ?? false,
        tags: ps.tags ?? [],
        hasVariants: ps.variants.length > 1,
        variants: {
          create: ps.variants.map((v, vi) => ({
            sku: v.sku,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            inventory: { create: { quantity: v.qty } },
            attributes: {
              create: v.attrs.map(a => ({ key: a.key, value: a.value })),
            },
            images: {
              create: [{
                url: v.imageUrl,
                altText: v.imageAlt,
                position: 1,
                isPrimary: vi === 0,
              }],
            },
          })),
        },
      },
      include: { variants: true },
    });

    createdProducts.push({
      id: product.id,
      name: product.name,
      storeIdx: ps.storeIdx,
      variants: product.variants.map(v => ({ id: v.id, sku: v.sku, price: Number(v.price) })),
    });
  }
  console.log(`✓ ${productSeeds.length} products with ${productSeeds.reduce((s, p) => s + p.variants.length, 0)} variants created.\n`);

  // ═══════════════════════════════════════════════════════════════
  //  ORDERS, PAYMENTS, SHIPMENTS
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating orders...');
  const ORDER_STATUSES = ['PENDING', 'RECEIVED', 'SHIPPED', 'DELIVERED', 'SUCCESS', 'CANCELLED'] as const;
  const PAYMENT_METHODS = ['RAZORPAY', 'COD'] as const;

  const orderIds: string[] = [];

  for (let i = 0; i < 25; i++) {
    const customer = customers[i % customers.length];
    const numItems = 1 + Math.floor(Math.random() * 3);
    const usedProducts = new Set<number>();
    const items: Array<{ variantId: string; productName: string; storeName: string; imageUrl: string; price: number; quantity: number }> = [];

    for (let j = 0; j < numItems; j++) {
      let pIdx: number;
      do { pIdx = Math.floor(Math.random() * createdProducts.length); } while (usedProducts.has(pIdx) && usedProducts.size < createdProducts.length);
      usedProducts.add(pIdx);
      const product = createdProducts[pIdx];
      const variant = product.variants[Math.floor(Math.random() * product.variants.length)];
      const qty = 1 + Math.floor(Math.random() * 3);

      items.push({
        variantId: variant.id,
        productName: product.name,
        storeName: stores[product.storeIdx].name,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=200',
        price: variant.price,
        quantity: qty,
      });
    }

    const totalAmount = items.reduce((s, it) => s + it.price * it.quantity, 0);
    const status = ORDER_STATUSES[Math.floor(Math.random() * ORDER_STATUSES.length)];
    const paymentMethod = PAYMENT_METHODS[Math.floor(Math.random() * 2)];
    const paymentStatus = status === 'CANCELLED' ? 'FAILED' : status === 'PENDING' ? 'PENDING' : 'SUCCESS';
    const orderDate = randomDate(60);

    const addr = addressData[i % addressData.length];

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        trackingToken: crypto.randomBytes(16).toString('hex'),
        userId: customer.id,
        status,
        paymentStatus: paymentStatus as any,
        paymentMethod: paymentMethod as any,
        totalAmount,
        createdAt: orderDate,
        items: {
          create: items.map(it => ({
            variantId: it.variantId,
            productName: it.productName,
            productSlug: it.productName.toLowerCase().replace(/\s+/g, '-'),
            storeName: it.storeName,
            imageUrl: it.imageUrl,
            attributesSnapshot: [],
            price: it.price,
            quantity: it.quantity,
            subtotal: it.price * it.quantity,
          })),
        },
        orderAddress: {
          create: {
            name: customer.fullName,
            phone: `+91 ${9800000000 + i}`,
            email: customer.email,
            addressLine1: `${100 + i}, MG Road`,
            city: addr.city,
            state: addr.state,
            postalCode: addr.postalCode,
          },
        },
      },
    });

    orderIds.push(order.id);

    // Create payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        gateway: paymentMethod as any,
        amount: totalAmount,
        status: paymentStatus as any,
        paidAt: paymentStatus === 'SUCCESS' ? new Date(orderDate.getTime() + 600000) : null,
        createdAt: orderDate,
      },
    });

    // Create shipments for shipped/delivered/success orders
    if (['SHIPPED', 'DELIVERED', 'SUCCESS'].includes(status)) {
      const shipStatus = status === 'SHIPPED' ? 'IN_TRANSIT' : 'DELIVERED';
      await prisma.orderShipment.create({
        data: {
          orderId: order.id,
          courierName: ['BlueDart', 'DTDC', 'Delhivery', 'FedEx'][Math.floor(Math.random() * 4)],
          trackingNumber: `TRK${Date.now().toString(36).toUpperCase()}${i}`,
          trackingUrl: 'https://track.example.com',
          status: shipStatus as any,
          shippedAt: new Date(orderDate.getTime() + 86400000),
          deliveredAt: shipStatus === 'DELIVERED' ? new Date(orderDate.getTime() + 86400000 * 3) : null,
          createdAt: orderDate,
        },
      });
    }

    // Order log
    await prisma.orderLog.create({
      data: {
        orderId: order.id,
        adminId: admin.id,
        action: 'STATUS_UPDATE',
        toStatus: status as any,
        note: `Order placed with status ${status}`,
        createdAt: orderDate,
      },
    });
  }
  console.log(`✓ 25 orders with payments and shipments created.\n`);

  // ═══════════════════════════════════════════════════════════════
  //  STOREFRONT CMS SECTIONS
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating storefront sections...');
  await prisma.storefrontSection.createMany({
    data: [
      {
        page: 'home', type: 'HERO_BANNER', title: 'Welcome to AuraZone',
        subtitle: 'Shop Your Style, Your Way', isActive: true, sortOrder: 1,
        content: {
          heading: 'Summer Collection 2026',
          subheading: 'Up to 50% off on premium fashion and footwear brands. Explore our multi-store marketplace.',
          buttonText: 'Shop Now', buttonLink: '/products',
          gradient: 'linear-gradient(135deg, #0F1923 0%, #3B5249 100%)',
          imageUrl: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=1200',
        },
      },
      {
        page: 'home', type: 'STORE_GRID', title: 'Explore Our Stores',
        subtitle: 'Each store is a curated universe', isActive: true, sortOrder: 2,
        content: { columns: 5 },
      },
      {
        page: 'home', type: 'PRODUCT_CAROUSEL', title: 'Trending Now',
        subtitle: 'Top products across all stores', isActive: true, sortOrder: 3,
        content: { limit: 12, filterFeatured: true },
      },
      {
        page: 'home', type: 'PROMO_BANNER', title: 'Sneaker Fest',
        subtitle: null, isActive: true, sortOrder: 4,
        content: {
          heading: 'Step Up Your Game', subheading: 'Extra 20% off on all sneakers this weekend.',
          bgColor: '#F0F2ED', textColor: '#111827', link: '/store/shoes/sneakers',
          imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=600',
        },
      },
      {
        page: 'home', type: 'CATEGORY_GRID', title: 'Shop by Category',
        subtitle: 'Find exactly what you need', isActive: true, sortOrder: 5,
        content: { columns: 4 },
      },
      {
        page: 'home', type: 'PRODUCT_CAROUSEL', title: 'New Arrivals',
        subtitle: 'Fresh drops you don\'t want to miss', isActive: true, sortOrder: 6,
        content: { limit: 8, sortBy: 'createdAt' },
      },
      {
        page: 'home', type: 'TEXT_BLOCK', title: 'Why AuraZone?',
        subtitle: null, isActive: true, sortOrder: 7,
        content: {
          heading: 'The Premium Multi-Store Marketplace',
          body: 'AuraZone brings together curated stores under one roof — fashion, footwear, cosmetics, home decor, and electronics. Each store is independently managed with its own unique identity and products.',
          alignment: 'center',
        },
      },
      {
        page: 'home', type: 'COUNTDOWN_TIMER', title: 'Flash Sale Ends In',
        subtitle: null, isActive: true, sortOrder: 8,
        content: {
          endDate: new Date(Date.now() + 86400000 * 3).toISOString(),
          heading: '🔥 Flash Sale — Up to 70% Off',
          subheading: 'Limited time offers on electronics and fashion',
          bgColor: '#0F172A', textColor: '#FFFFFF',
        },
      },
    ],
  });
  console.log('✓ 8 storefront sections created.\n');

  // ═══════════════════════════════════════════════════════════════
  //  PRODUCT REVIEWS
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating product reviews...');
  const reviewComments = [
    'Absolutely love this product! Highly recommended.',
    'Good quality for the price. Would buy again.',
    'It is okay, but I expected a bit more based on the photos.',
    'Fast delivery and excellent packaging.',
    'Not exactly what I was looking for, but decent.',
    'Exceeded my expectations! Will recommend to friends.',
    'Very comfortable and looks great.',
    'The fit is perfect and the material feels premium.',
  ];

  let reviewCount = 0;
  for (let i = 0; i < createdProducts.length; i++) {
    const product = createdProducts[i];
    // Add 1 to 4 reviews per product
    const numReviews = 1 + Math.floor(Math.random() * 4);

    // Pick random customers
    const shuffledCustomers = [...customers].sort(() => 0.5 - Math.random());
    const selectedCustomers = shuffledCustomers.slice(0, numReviews);

    for (const customer of selectedCustomers) {
      const rating = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5 stars
      const body = reviewComments[Math.floor(Math.random() * reviewComments.length)];

      await prisma.productReview.create({
        data: {
          productId: product.id,
          userId: customer.id,
          rating,
          body,
          isApproved: true,
          createdAt: randomDate(30),
        },
      });
      reviewCount++;
    }
  }
  console.log(`✓ ${reviewCount} product reviews created.\n`);

  // ═══════════════════════════════════════════════════════════════
  //  ADMIN AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating audit logs...');
  const auditActions = [
    { action: 'CREATE', entity: 'STORE', entityId: stores[0].id, entityName: 'Aura Fashion' },
    { action: 'CREATE', entity: 'STORE', entityId: stores[1].id, entityName: 'Aura Shoes' },
    { action: 'UPDATE', entity: 'STORE', entityId: stores[0].id, entityName: 'Aura Fashion', changes: { before: { description: 'Old desc' }, after: { description: stores[0].description } } },
    { action: 'CREATE', entity: 'PRODUCT', entityId: createdProducts[0].id, entityName: createdProducts[0].name },
    { action: 'CREATE', entity: 'PRODUCT', entityId: createdProducts[1].id, entityName: createdProducts[1].name },
    { action: 'UPDATE', entity: 'PRODUCT', entityId: createdProducts[0].id, entityName: createdProducts[0].name, changes: { before: { price: 699 }, after: { price: 799 } } },
    { action: 'CREATE', entity: 'CATEGORY', entityId: catMap['fashion'][0].id, entityName: 'T-Shirts' },
    { action: 'CREATE', entity: 'STOREFRONT_SECTION', entityId: 'hero-section', entityName: 'Hero Banner' },
    { action: 'UPDATE', entity: 'INVENTORY', entityId: createdProducts[0].variants[0].id, entityName: 'Stock: 50 → 100' },
    { action: 'TOGGLE_STATUS', entity: 'PRODUCT', entityId: createdProducts[2].id, entityName: createdProducts[2].name },
  ];

  for (let i = 0; i < auditActions.length; i++) {
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        ...auditActions[i],
        changes: (auditActions[i] as any).changes ?? undefined,
        createdAt: randomDate(30),
      },
    });
  }
  console.log(`✓ ${auditActions.length} audit logs created.\n`);

  // ═══════════════════════════════════════════════════════════════
  //  NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════
  console.log('Creating notifications...');
  const notifTemplates = [
    { title: 'New Order Received', body: 'Order #AZ-XYZ has been placed by Arjun Patel for ₹3,499.', url: '/orders' },
    { title: 'Low Stock Alert', body: 'Leather Biker Jacket (FASH-JK-BK-L) has only 15 units remaining.', url: '/inventory' },
    { title: 'Order Shipped', body: 'Order #AZ-ABC has been shipped via BlueDart (TRK123456).', url: '/shipments' },
    { title: 'Payment Received', body: 'Payment of ₹2,999 received for order #AZ-DEF via Razorpay.', url: '/payments' },
    { title: 'New Customer Registered', body: 'Sanjana Rao has created a new account.', url: '/customers' },
    { title: 'Storefront Updated', body: 'Hero Banner section has been modified by Store Manager.', url: '/storefront' },
    { title: 'Revenue Milestone', body: 'Congratulations! Total revenue has crossed ₹1,00,000 this month.', url: '/analytics' },
    { title: 'System Update', body: 'AuraZone v2.1 has been deployed with performance improvements.', url: null },
    { title: 'Order Cancelled', body: 'Order #AZ-GHI has been cancelled by customer.', url: '/orders' },
    { title: 'Inventory Restocked', body: 'Pro Running Sneakers restocked — 50 units added to inventory.', url: '/inventory' },
  ];

  for (let i = 0; i < notifTemplates.length; i++) {
    await prisma.notificationHistory.create({
      data: {
        userId: admin.id,
        title: notifTemplates[i].title,
        body: notifTemplates[i].body,
        url: notifTemplates[i].url,
        isRead: i > 4, // first 5 are unread
        createdAt: randomDate(14),
      },
    });
  }

  // Notification preferences for admin
  await prisma.notificationPreferences.create({
    data: {
      userId: admin.id,
      newOrders: true,
      orderStatusChange: true,
      lowStock: true,
      promotions: true,
      otherEvents: true,
    },
  });
  console.log('✓ 10 notifications + preferences created.\n');

  // ═══════════════════════════════════════════════════════════════
  //  DONE
  // ═══════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════');
  console.log('✅ Database seeded successfully!');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('Admin Login:');
  console.log('  Email:    admin@aurazone.com');
  console.log('  Password: Admin@123');
  console.log('');
  console.log('Manager Login:');
  console.log('  Email:    manager@aurazone.com');
  console.log('  Password: Admin@123');
  console.log('');
  console.log('Customer Login:');
  console.log('  Email:    arjun.patel@example.com');
  console.log('  Password: Customer@123');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });