ALTER TABLE "barang"
ALTER COLUMN "kategori" TYPE VARCHAR(255)
USING CASE "kategori"::text
  WHEN '1' THEN 'Obat Bebas'
  WHEN '2' THEN 'Suplemen'
  WHEN '3' THEN 'Obat Keras'
  WHEN '4' THEN 'Obat Bebas Terbatas'
  WHEN '5' THEN 'Antiseptik'
  WHEN '6' THEN 'Alat Kesehatan'
  ELSE "kategori"::text
END;
