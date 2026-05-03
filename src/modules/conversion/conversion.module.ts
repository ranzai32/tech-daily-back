import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversionSignal } from './conversion-signal.entity';
import { ConversionService } from './conversion.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConversionSignal])],
  providers: [ConversionService],
  exports: [ConversionService],
})
export class ConversionModule {}
