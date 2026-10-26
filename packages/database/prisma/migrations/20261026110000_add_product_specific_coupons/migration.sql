-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "banner_color" TEXT,
ADD COLUMN IF NOT EXISTS "banner_text" TEXT,
ADD COLUMN IF NOT EXISTS "is_product_specific" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "show_in_storefront" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CouponProduct" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CouponUsage" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CouponProduct_coupon_id_idx" ON "CouponProduct"("coupon_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CouponProduct_product_id_idx" ON "CouponProduct"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CouponProduct_coupon_id_product_id_key" ON "CouponProduct"("coupon_id", "product_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CouponUsage_coupon_id_email_idx" ON "CouponUsage"("coupon_id", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CouponUsage_user_id_idx" ON "CouponUsage"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CouponUsage_coupon_id_user_id_key" ON "CouponUsage"("coupon_id", "user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Coupon_show_in_storefront_idx" ON "Coupon"("show_in_storefront");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CouponProduct_coupon_id_fkey'
    ) THEN
        ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CouponProduct_product_id_fkey'
    ) THEN
        ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CouponUsage_coupon_id_fkey'
    ) THEN
        ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CouponUsage_user_id_fkey'
    ) THEN
        ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CouponUsage_order_id_fkey'
    ) THEN
        ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
