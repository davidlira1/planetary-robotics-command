import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiController } from './controllers/api.controller';
import { HealthController } from './health/health.controller';
import { PersistenceModule } from './modules/persistence.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PersistenceModule,
  ],
  controllers: [ApiController, HealthController],
})
export class AppModule {}
