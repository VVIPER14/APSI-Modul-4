ALTER TABLE "detail_pengajuan"
ADD COLUMN "id_supplier" VARCHAR(255);

ALTER TABLE "detail_pengajuan"
ADD CONSTRAINT "detail_pengajuan_id_supplier_fkey"
FOREIGN KEY ("id_supplier") REFERENCES "supplier"("id_suplier")
ON DELETE NO ACTION ON UPDATE NO ACTION;

WITH supplier_by_item AS (
  SELECT
    order_header."id_pengajuan",
    order_detail."id_barang",
    MIN(order_header."id_supplier") AS "id_supplier"
  FROM "pemesanan" AS order_header
  INNER JOIN "detail_pemesanan" AS order_detail
    ON order_detail."id_pemesanan" = order_header."id_pemesanan"
  WHERE order_header."id_supplier" IS NOT NULL
  GROUP BY order_header."id_pengajuan", order_detail."id_barang"
  HAVING COUNT(DISTINCT order_header."id_supplier") = 1
)
UPDATE "detail_pengajuan" AS proposal_detail
SET "id_supplier" = supplier_by_item."id_supplier"
FROM supplier_by_item
WHERE proposal_detail."id_pengajuan" = supplier_by_item."id_pengajuan"
  AND proposal_detail."id_barang" = supplier_by_item."id_barang";

ALTER TABLE "pengajuan"
ALTER COLUMN "harga_total" TYPE DECIMAL(19, 0)
USING "harga_total"::DECIMAL(19, 0);

UPDATE "pengajuan" AS proposal
SET "status_penyetujuan" = 2
WHERE proposal."status_penyetujuan" = 1
  AND proposal."id_penyetuju" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "pemesanan" AS order_header
    WHERE order_header."id_pengajuan" = proposal."id_pengajuan"
  );

ALTER TABLE "pengajuan"
ADD CONSTRAINT "pengajuan_status_penyetujuan_check"
CHECK ("status_penyetujuan" IS NULL OR "status_penyetujuan" IN (0, 1, 2, 3));
