import { IsArray, IsInt, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveMcqAnswerDto {
  @ApiProperty({ example: 1, description: 'MCQ Problem ID' })
  @IsInt()
  problemId: number;

  @ApiProperty({
    type: [String],
    example: ['3f2504e0-4f89-11d3-9a0c-0305e82c3301'],
    description: 'Array of selected option UUIDs',
  })
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds: string[];
}
