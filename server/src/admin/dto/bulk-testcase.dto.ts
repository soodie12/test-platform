import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTestCaseItemDto {
  @IsString()
  @IsNotEmpty()
  input: string;

  @IsString()
  @IsNotEmpty()
  expectedOutput: string;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}

export class BulkCreateTestCasesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTestCaseItemDto)
  testCases: CreateTestCaseItemDto[];
}
