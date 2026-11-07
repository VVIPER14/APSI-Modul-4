ALTER TABLE "detail_transaksi"
ADD COLUMN IF NOT EXISTS "harga_satuan_jual" DECIMAL(19, 0);

UPDATE "detail_transaksi" AS detail
SET "harga_satuan_jual" = product."harga_jual"
FROM "barang" AS product
WHERE product."id_barang" = detail."id_barang"
  AND detail."harga_satuan_jual" IS NULL;
