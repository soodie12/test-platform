import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutosaveService } from './autosave.service';
import { AutosaveController } from './autosave.controller';
import { AutoSave } from '../entities/auto-save.entity';
import { ExamsModule } from '../exams/exams.module';

@Module({
  imports: [TypeOrmModule.forFeature([AutoSave]), ExamsModule],
  controllers: [AutosaveController],
  providers: [AutosaveService],
  exports: [AutosaveService],
})
export class AutosaveModule {}
