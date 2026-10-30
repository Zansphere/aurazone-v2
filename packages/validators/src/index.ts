import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters").optional(),
});

export const phoneLoginSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number"),
});

export const otpVerifySchema = z.object({
  phoneNumber: z.string(),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// ─── Address ──────────────────────────────────────────────────────────────────
export const addressSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(70, "Name cannot exceed 70 characters")
    .regex(/^[a-zA-Z\s.'-]+$/, "Name should contain letters only"),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+91[\-\s]?)?[6-9]\d{9}$|^\+?[1-9]\d{9,14}$/, "Please enter a valid 10-digit mobile number")
    .max(15, "Phone number cannot exceed 15 digits"),
  addressLine1: z
    .string()
    .trim()
    .min(5, "Address must be at least 5 characters")
    .max(120, "Address cannot exceed 120 characters"),
  addressLine2: z
    .string()
    .trim()
    .max(120, "Address line 2 cannot exceed 120 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  city: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(50, "City cannot exceed 50 characters")
    .regex(/^[a-zA-Z\s.-]+$/, "City should contain letters only"),
  state: z
    .string()
    .trim()
    .min(2, "State must be at least 2 characters")
    .max(50, "State cannot exceed 50 characters"),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Postal code must be a valid 6-digit PIN code"),
  country: z.string().default("IN"),
  isDefault: z.boolean().default(false),
});

// ─── Store ────────────────────────────────────────────────────────────────────
export const storeSchema = z.object({
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// ─── Category ─────────────────────────────────────────────────────────────────
export const categorySchema = z.object({
  storeId: z.string().uuid(),
  parentId: z.string().uuid().optional().nullable(),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens"),
  name: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// ─── Attribute Template ───────────────────────────────────────────────────────
export const attributeTemplateSchema = z.object({
  storeId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "Name is required"),
  key: z
    .string()
    .min(1)
    .regex(/^[a-z_]+$/, "Key must be lowercase with underscores"),
  fieldType: z.enum([
    "TEXT",
    "NUMBER",
    "SELECT",
    "MULTI_SELECT",
    "COLOR_PICKER",
    "BOOLEAN",
    "MEDIA",
  ]),
  options: z.array(z.string()).optional().nullable(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  isRequired: z.boolean().default(true),
  isVariant: z.boolean().default(true),
  isFilterable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// ─── Product ──────────────────────────────────────────────────────────────────
export const productVariantAttributeSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

export const productVariantSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  price: z.number().positive("Price must be positive"),
  compareAtPrice: z.number().positive().optional().nullable(),
  isAvailable: z.boolean().default(true),
  attributes: z.array(productVariantAttributeSchema),
  quantity: z.number().int().min(1, "Stock quantity must be at least 1").default(1),
  images: z.array(z.any()).optional(),
});

export const productSchema = z.object({
  storeId: z.string().uuid("Invalid store"),
  categoryId: z.string().uuid("Invalid category"),
  name: z.string().trim().min(1, "Name is required").max(100, "Name cannot exceed 100 characters").regex(/^[a-zA-Z0-9\s\-&.,]+$/, "Only English letters, numbers, and basic punctuation are allowed"),
  brand: z.string().max(255, "Brand cannot exceed 255 characters").optional(),
  modelNumber: z.string().max(255, "Model number cannot exceed 255 characters").optional(),
  gender: z.enum(["MEN", "WOMEN", "UNISEX", "KIDS"]).optional().nullable(),
  description: z.string().min(1, "Description is required"),
  shortDescription: z.string().max(500, "Short description cannot exceed 500 characters").optional(),
  tags: z.array(z.string()).default([]),
  hasVariants: z.boolean().default(true),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  variants: z.array(productVariantSchema).min(1, "At least one variant required"),
});

// ─── Cart ─────────────────────────────────────────────────────────────────────
export const addToCartSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
});

// ─── Order ────────────────────────────────────────────────────────────────────
export const createOrderSchema = z.object({
  addressId: z.string().uuid().optional(),
  address: addressSchema.optional(),
  paymentMethod: z.enum(["RAZORPAY", "COD"]),
});

export const createDirectOrderSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  addressId: z.string().uuid().optional(),
  address: addressSchema.optional(),
  paymentMethod: z.enum(["RAZORPAY", "COD"]),
});

// ─── Storefront ───────────────────────────────────────────────────────────────
export const storefrontSectionSchema = z.object({
  storeId: z.string().uuid().optional().nullable(),
  page: z.string().min(1).default("home"),
  type: z.enum([
    "HERO_BANNER",
    "PRODUCT_CAROUSEL",
    "CATEGORY_GRID",
    "STORE_GRID",
    "PROMO_BANNER",
    "TEXT_BLOCK",
    "IMAGE_GALLERY",
    "COUNTDOWN_TIMER",
    "CUSTOM_HTML",
  ]),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.record(z.unknown()),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type StoreInput = z.infer<typeof storeSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type AttributeTemplateInput = z.infer<typeof attributeTemplateSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ProductVariantInput = z.infer<typeof productVariantSchema>;
export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type StorefrontSectionInput = z.infer<typeof storefrontSectionSchema>;
