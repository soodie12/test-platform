import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProctoringLog } from './entities/proctoring-log.entity';
import { ProctoringService } from './proctoring.service';
import { ProctoringController } from './proctoring.controller';
import { AdminGuard } from '../admin/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ProctoringLog])],
  providers: [ProctoringService, AdminGuard],
  controllers: [ProctoringController],
  exports: [ProctoringService],
})
export class ProctoringModule {}
