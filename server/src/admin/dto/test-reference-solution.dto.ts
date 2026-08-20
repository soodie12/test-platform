import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReferenceSolutionTestCaseItemDto {
  @IsString()
  input: string;

  @IsString()
  @IsOptional()
  expectedOutput?: string;
}

export class TestReferenceSolutionDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsInt()
  languageId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceSolutionTestCaseItemDto)
  testCases: ReferenceSolutionTestCaseItemDto[];

  @IsInt()
  @IsOptional()
  timeLimitMs?: number;

  @IsInt()
  @IsOptional()
  memoryLimitKb?: number;
}
