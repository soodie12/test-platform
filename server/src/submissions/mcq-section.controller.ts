import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { McqSectionSubmitDto } from './dto/mcq-section-submit.dto';
import { SaveMcqAnswerDto } from './dto/save-mcq-answer.dto';
import { Auth } from '../common/decorators/auth.decorator';
import { AuthType } from '../common/enums/auth-type.enum';
import { ExamWindowGuard } from '../exams/guards/exam-window.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { User } from '../entities/user.entity';

@ApiTags('MCQ Section')
@ApiBearerAuth()
@Controller('exams/:examId/mcq-section')
export class McqSectionController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post('answer')
  @Auth(AuthType.JWT, [ExamWindowGuard])
  @ApiOperation({
    summary: 'Auto-submit a single MCQ answer immediately upon candidate selection',
    description:
      'Instantly evaluates and records the candidate choice for an MCQ question. Allows updating choices anytime during the exam window.',
  })
  @ApiParam({ name: 'examId', type: Number })
  @ApiBody({ type: SaveMcqAnswerDto })
  @ApiResponse({
    status: 200,
    description: 'Answer auto-saved and evaluated',
  })
  async saveAnswer(
    @Param('examId', ParseIntPipe) examId: number,
    @Body() dto: SaveMcqAnswerDto,
    @GetUser() user: User,
  ) {
    return this.submissionsService.saveMcqAnswer(
      user.id,
      examId,
      dto.problemId,
      dto.selectedOptionIds,
    );
  }

  @Get('my-answers')
  @Auth()
  @ApiOperation({ summary: 'Get student saved MCQ answers for an exam' })
  @ApiParam({ name: 'examId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Saved MCQ answers mapping problemId to selectedOptionIds',
  })
  async getMyAnswers(
    @Param('examId', ParseIntPipe) examId: number,
    @GetUser() user: User,
  ) {
    return this.submissionsService.getMyMcqAnswers(user.id, examId);
  }

  @Post('submit')
  @Auth(AuthType.JWT, [ExamWindowGuard])
  @ApiOperation({
    summary: 'Submit all MCQ answers as a single atomic batch',
    description:
      'Submits answers for ALL MCQ questions in the exam at once. Partial submission is not allowed - all MCQ questions must have an answer. Once submitted, answers cannot be changed.',
  })
  @ApiParam({ name: 'examId', type: Number })
  @ApiBody({ type: McqSectionSubmitDto })
  @ApiResponse({
    status: 201,
    description: 'MCQ section submitted',
    schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              problemId: { type: 'number' },
              verdict: { type: 'string', example: 'accepted' },
              score: { type: 'number', example: 10 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Unanswered MCQ questions or invalid option IDs',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Exam window is not active' })
  @ApiResponse({ status: 409, description: 'MCQ section already submitted' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async submit(
    @Param('examId', ParseIntPipe) examId: number,
    @Body() dto: McqSectionSubmitDto,
    @GetUser() user: User,
  ) {
    return this.submissionsService.submitMcqSection(
      user.id,
      examId,
      dto.answers,
    );
  }
}
