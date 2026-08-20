import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSqlQuestionType1774500000000 implements MigrationInterface {
  name = 'AddSqlQuestionType1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "problems" ALTER COLUMN "questionType" TYPE character varying(10)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No action needed
  }
}
