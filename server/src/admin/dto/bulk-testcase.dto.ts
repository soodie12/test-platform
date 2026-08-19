import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
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

  @IsNumber()
  @IsOptional()
  @Min(0)
  score?: number;
}

export class BulkCreateTestCasesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTestCaseItemDto)
  testCases: CreateTestCaseItemDto[];
}
