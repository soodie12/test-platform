import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropProblemToExamDisplayOrderUnique1774700000000 implements MigrationInterface {
  name = 'DropProblemToExamDisplayOrderUnique1774700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "problem_to_exam" DROP CONSTRAINT IF EXISTS "UQ_e879bd1316d5daf12f71bf00c3c"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "problem_to_exam" ADD CONSTRAINT "UQ_e879bd1316d5daf12f71bf00c3c" UNIQUE ("examId", "displayOrder")
    `);
  }
}
