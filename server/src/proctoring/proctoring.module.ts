import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProctoringLog } from './entities/proctoring-log.entity';
import { ProctoringService } from './proctoring.service';
import { ProctoringController } from './proctoring.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProctoringLog])],
  providers: [ProctoringService],
  controllers: [ProctoringController],
  exports: [ProctoringService],
})
export class ProctoringModule {}
