-- DropIndex
DROP INDEX IF EXISTS "Category_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Category_store_id_slug_key" ON "Category"("store_id", "slug");

