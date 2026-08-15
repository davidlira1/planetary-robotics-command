import {
  PrismaAlertRepository,
  PrismaFleetReadRepository,
  PrismaRobotCurrentStateRepository,
  PrismaRobotHealthRepository,
  PrismaRobotRepository,
  PrismaRobotTelemetryRepository,
  PrismaUnitOfWork,
} from '@prc/persistence-prisma';
import { Global, Module } from '@nestjs/common';
import { NestAppLogger } from '../logging/nest-app-logger';
import { NestPrismaClient } from '../infrastructure/nest-prisma-client';
import {
  ALERT_REPOSITORY,
  APP_LOGGER,
  DATABASE_READINESS,
  FLEET_READ_REPOSITORY,
  ROBOT_CURRENT_STATE_REPOSITORY,
  ROBOT_HEALTH_REPOSITORY,
  ROBOT_REPOSITORY,
  ROBOT_TELEMETRY_REPOSITORY,
  UNIT_OF_WORK,
} from '../di/tokens';

@Global()
@Module({
  providers: [
    NestPrismaClient,
    NestAppLogger,
    {
      provide: ROBOT_REPOSITORY,
      useFactory: (prisma: NestPrismaClient) => new PrismaRobotRepository(prisma),
      inject: [NestPrismaClient],
    },
    {
      provide: ROBOT_CURRENT_STATE_REPOSITORY,
      useFactory: (prisma: NestPrismaClient) =>
        new PrismaRobotCurrentStateRepository(prisma),
      inject: [NestPrismaClient],
    },
    {
      provide: ROBOT_TELEMETRY_REPOSITORY,
      useFactory: (prisma: NestPrismaClient) =>
        new PrismaRobotTelemetryRepository(prisma),
      inject: [NestPrismaClient],
    },
    {
      provide: ROBOT_HEALTH_REPOSITORY,
      useFactory: (prisma: NestPrismaClient) =>
        new PrismaRobotHealthRepository(prisma),
      inject: [NestPrismaClient],
    },
    {
      provide: ALERT_REPOSITORY,
      useFactory: (prisma: NestPrismaClient) => new PrismaAlertRepository(prisma),
      inject: [NestPrismaClient],
    },
    {
      provide: FLEET_READ_REPOSITORY,
      useFactory: (prisma: NestPrismaClient) =>
        new PrismaFleetReadRepository(prisma),
      inject: [NestPrismaClient],
    },
    {
      provide: UNIT_OF_WORK,
      useFactory: (prisma: NestPrismaClient) => new PrismaUnitOfWork(prisma),
      inject: [NestPrismaClient],
    },
    {
      provide: DATABASE_READINESS,
      useExisting: NestPrismaClient,
    },
    {
      provide: APP_LOGGER,
      useExisting: NestAppLogger,
    },
  ],
  exports: [
    DATABASE_READINESS,
    ROBOT_REPOSITORY,
    ROBOT_CURRENT_STATE_REPOSITORY,
    ROBOT_TELEMETRY_REPOSITORY,
    ROBOT_HEALTH_REPOSITORY,
    ALERT_REPOSITORY,
    FLEET_READ_REPOSITORY,
    UNIT_OF_WORK,
    APP_LOGGER,
  ],
})
export class PersistenceModule {}
