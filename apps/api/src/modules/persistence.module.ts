import {
  PrismaRobotCurrentStateRepository,
  PrismaRobotRepository,
  PrismaRobotTelemetryRepository,
  PrismaUnitOfWork,
} from '@prc/persistence-prisma';
import { Global, Module } from '@nestjs/common';
import { NestAppLogger } from '../logging/nest-app-logger';
import { PrismaService } from '../persistence/prisma.service';
import {
  APP_LOGGER,
  ROBOT_CURRENT_STATE_REPOSITORY,
  ROBOT_REPOSITORY,
  ROBOT_TELEMETRY_REPOSITORY,
  UNIT_OF_WORK,
} from '../di/tokens';

@Global()
@Module({
  providers: [
    PrismaService,
    NestAppLogger,
    {
      provide: ROBOT_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaRobotRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ROBOT_CURRENT_STATE_REPOSITORY,
      useFactory: (prisma: PrismaService) =>
        new PrismaRobotCurrentStateRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ROBOT_TELEMETRY_REPOSITORY,
      useFactory: (prisma: PrismaService) =>
        new PrismaRobotTelemetryRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: UNIT_OF_WORK,
      useFactory: (prisma: PrismaService) => new PrismaUnitOfWork(prisma),
      inject: [PrismaService],
    },
    {
      provide: APP_LOGGER,
      useExisting: NestAppLogger,
    },
  ],
  exports: [
    PrismaService,
    ROBOT_REPOSITORY,
    ROBOT_CURRENT_STATE_REPOSITORY,
    ROBOT_TELEMETRY_REPOSITORY,
    UNIT_OF_WORK,
    APP_LOGGER,
  ],
})
export class PersistenceModule {}
