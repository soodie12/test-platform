import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHasExitedToEnrollment1774400000000 implements MigrationInterface {
  name = 'AddHasExitedToEnrollment1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "exam_enrollments" ADD COLUMN IF NOT EXISTS "hasExited" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "exam_enrollments" ADD COLUMN IF NOT EXISTS "exitReason" character varying(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "exam_enrollments" DROP COLUMN IF EXISTS "hasExited"
    `);
    await queryRunner.query(`
      ALTER TABLE "exam_enrollments" DROP COLUMN IF EXISTS "exitReason"
    `);
  }
}
