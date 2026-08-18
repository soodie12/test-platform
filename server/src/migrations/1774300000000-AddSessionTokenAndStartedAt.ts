import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionTokenAndStartedAt1774300000000 implements MigrationInterface {
  name = 'AddSessionTokenAndStartedAt1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessionToken" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "exam_enrollments" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "sessionToken"
    `);
    await queryRunner.query(`
      ALTER TABLE "exam_enrollments" DROP COLUMN IF EXISTS "startedAt"
    `);
  }
}
