import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSqlQuestionType1774500000000 implements MigrationInterface {
  name = 'AddSqlQuestionType1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // questionType is character varying(10), which already supports 'coding', 'mcq', and 'sql'.
    // No DDL table alteration needed.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No action needed
  }
}
