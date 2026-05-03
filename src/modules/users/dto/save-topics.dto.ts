import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class SaveTopicsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  topic_ids: string[];
}
