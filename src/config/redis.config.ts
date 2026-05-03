import { BullModuleOptions } from '@nestjs/bull';

export default (): BullModuleOptions => ({
  redis: process.env.REDIS_URL as string,
});
