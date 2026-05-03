import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SkillLevel } from '../../../common/enums/skill-level.enum';

export class UpdateProfileDto {
  @IsOptional()
  @IsEnum(SkillLevel)
  skill_level?: SkillLevel;

  @IsOptional()
  @IsString()
  full_name?: string;
}
