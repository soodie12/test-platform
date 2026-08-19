import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScoreToTestCase1774600000000 implements MigrationInterface {
  name = 'AddScoreToTestCase1774600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "test_cases" ADD COLUMN IF NOT EXISTS "score" double precision NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "test_cases" DROP COLUMN IF EXISTS "score"
    `);
  }
}
