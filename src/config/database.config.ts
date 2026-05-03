import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default (): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV !== 'production',
  migrations: ['dist/migrations/*{.js}'],
  migrationsRun: true,
});
