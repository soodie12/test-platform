import { Controller, Post, Get, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../common/decorators/auth.decorator';
import { AuthType } from '../common/enums/auth-type.enum';
import { GetUser } from '../common/decorators/get-user.decorator';
import { AdminGuard } from '../admin/guards/admin.guard';
import { ProctoringService } from './proctoring.service';
import { LogViolationDto } from './dto/log-violation.dto';
import { ProctoringLog } from './entities/proctoring-log.entity';
import { User } from '../entities/user.entity';

@ApiTags('Proctoring')
@Controller('proctoring')
export class ProctoringController {
  constructor(private readonly proctoringService: ProctoringService) {}

  @Post('log')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log a student proctoring violation (fullscreen exit, tab switch, window blur)' })
  async logViolation(
    @GetUser() user: User,
    @Body() dto: LogViolationDto,
  ): Promise<ProctoringLog> {
    return this.proctoringService.logViolation(user.id, dto);
  }

  @Get('exam/:examId')
  @Auth(AuthType.JWT, [AdminGuard])
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all proctoring violation logs for an exam (Admin)' })
  async getLogsByExam(
    @Param('examId', ParseIntPipe) examId: number,
  ): Promise<ProctoringLog[]> {
    return this.proctoringService.getLogsByExam(examId);
  }

  @Get('exam/:examId/summary')
  @Auth(AuthType.JWT, [AdminGuard])
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get violation count summary per student for an exam (Admin)' })
  async getViolationCounts(
    @Param('examId', ParseIntPipe) examId: number,
  ): Promise<Record<number, number>> {
    return this.proctoringService.getViolationCountsByExam(examId);
  }

  @Get('exam/:examId/my-count')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user violation count for an exam' })
  async getMyViolationCount(
    @Param('examId', ParseIntPipe) examId: number,
    @GetUser('id') userId: number,
  ): Promise<{ count: number }> {
    const count = await this.proctoringService.getViolationCount(examId, userId);
    return { count };
  }
}
