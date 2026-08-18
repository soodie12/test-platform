import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExamAccommodations1774500000000 implements MigrationInterface {
  name = 'CreateExamAccommodations1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "exam_accommodations" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "userId" integer NOT NULL,
        "examId" integer NOT NULL,
        "extraMinutes" integer NOT NULL DEFAULT 0,
        "reason" character varying,
        CONSTRAINT "UQ_exam_accommodations_user_exam" UNIQUE ("userId", "examId"),
        CONSTRAINT "PK_exam_accommodations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_exam_accommodations_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_exam_accommodations_examId" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "exam_accommodations"
    `);
  }
}
