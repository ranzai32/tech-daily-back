import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Max, Min } from 'class-validator';

export class CompletedFlashcardsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit = 1;
}
