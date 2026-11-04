CREATE SEQUENCE "Place_id_seq";
ALTER TABLE "Place" ALTER COLUMN "id" SET DEFAULT nextval('"Place_id_seq"');
ALTER SEQUENCE "Place_id_seq" OWNED BY "Place"."id";
-- Reserve seed IDs, including when this migration runs before the initial seed.
SELECT setval('"Place_id_seq"', GREATEST(COALESCE((SELECT MAX("id") FROM "Place"), 0), 100000));
ALTER TABLE "Place"
  ADD COLUMN "category" VARCHAR(20) NOT NULL DEFAULT 'Landmark',
  ADD COLUMN "season" VARCHAR(20) NOT NULL DEFAULT 'AllYear',
  ADD COLUMN "address" VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN "description" VARCHAR(3000) NOT NULL DEFAULT '',
  ADD COLUMN "article" VARCHAR(20000) NOT NULL DEFAULT '',
  ADD COLUMN "imageUrl" VARCHAR(2048) NOT NULL DEFAULT '',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
