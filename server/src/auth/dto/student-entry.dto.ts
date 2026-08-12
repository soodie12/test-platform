import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class StudentEntryDto {
  @ApiProperty({
    example: '20CS101',
    description: 'Student Roll Number or ID',
  })
  @IsString()
  @IsNotEmpty()
  rollNumber: string;

  @ApiProperty({
    example: 'John',
    description: 'Student First Name',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Student Last Name',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;
}
