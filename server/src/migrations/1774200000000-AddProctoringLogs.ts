import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProctoringLogs1774200000000 implements MigrationInterface {
  name = 'AddProctoringLogs1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."proctoring_logs_event_type_enum" AS ENUM('FULLSCREEN_EXIT', 'TAB_SWITCH', 'WINDOW_BLUR')
    `);

    await queryRunner.query(`
      CREATE TABLE "proctoring_logs" (
        "id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "exam_id" integer NOT NULL,
        "event_type" "public"."proctoring_logs_event_type_enum" NOT NULL,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_proctoring_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_proctoring_logs_exam_user" ON "proctoring_logs" ("exam_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_proctoring_logs_exam_user"
    `);
    await queryRunner.query(`
      DROP TABLE "proctoring_logs"
    `);
    await queryRunner.query(`
      DROP TYPE "public"."proctoring_logs_event_type_enum"
    `);
  }
}
