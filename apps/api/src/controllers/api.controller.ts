import {
  FleetReadRepository,
  GetFleetSnapshot,
  GetRobot,
  IngestTelemetry,
  ListAlerts,
  ListRobotTelemetry,
  ListRobots,
} from '@prc/application';
import {
  ListAlertsQuerySchema,
  ListRobotsQuerySchema,
  ListTelemetryQuerySchema,
  IngestTelemetryRequestSchema,
} from '@prc/contracts';
import {
  AlertRepository,
  RobotCurrentStateRepository,
  RobotHealthRepository,
  RobotRepository,
  RobotTelemetryRepository,
  UnitOfWork,
  Logger as PortsLogger,
} from '@prc/ports';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ALERT_REPOSITORY,
  APP_LOGGER,
  FLEET_READ_REPOSITORY,
  ROBOT_CURRENT_STATE_REPOSITORY,
  ROBOT_HEALTH_REPOSITORY,
  ROBOT_REPOSITORY,
  ROBOT_TELEMETRY_REPOSITORY,
  UNIT_OF_WORK,
} from '../di/tokens';
import { RequestWithId } from '../middleware/request-id.middleware';

function toIso(date: Date): string {
  return date.toISOString();
}

function mapCurrentState(
  state: {
    position: { x: number; y: number; z: number };
    batteryPercent: number;
    temperatureCelsius: number;
    signalStrengthDbm: number;
    velocityMetersPerSecond: number;
    headingDegrees: number;
    recordedAt: Date;
    receivedAt: Date;
  } | null,
) {
  if (!state) return null;
  return {
    position: state.position,
    batteryPercent: state.batteryPercent,
    temperatureCelsius: state.temperatureCelsius,
    signalStrengthDbm: state.signalStrengthDbm,
    velocityMetersPerSecond: state.velocityMetersPerSecond,
    headingDegrees: state.headingDegrees,
    recordedAt: toIso(state.recordedAt),
    receivedAt: toIso(state.receivedAt),
  };
}

function mapHealth(
  health: {
    status: string;
    batteryStatus: string;
    temperatureStatus: string;
    signalStatus: string;
    evaluatedFromTelemetryId: string;
    evaluatedFromRecordedAt: Date;
    updatedAt: Date;
  } | null,
) {
  if (!health) return null;
  return {
    status: health.status,
    batteryStatus: health.batteryStatus,
    temperatureStatus: health.temperatureStatus,
    signalStatus: health.signalStatus,
    evaluatedFromTelemetryId: health.evaluatedFromTelemetryId,
    evaluatedFromRecordedAt: toIso(health.evaluatedFromRecordedAt),
    updatedAt: toIso(health.updatedAt),
  };
}

@Controller()
export class ApiController {
  private readonly ingestTelemetry: IngestTelemetry;
  private readonly listRobots: ListRobots;
  private readonly getRobot: GetRobot;
  private readonly listRobotTelemetry: ListRobotTelemetry;
  private readonly getFleetSnapshot: GetFleetSnapshot;
  private readonly listAlerts: ListAlerts;

  constructor(
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(ROBOT_REPOSITORY) robots: RobotRepository,
    @Inject(ROBOT_CURRENT_STATE_REPOSITORY)
    currentState: RobotCurrentStateRepository,
    @Inject(ROBOT_TELEMETRY_REPOSITORY) telemetry: RobotTelemetryRepository,
    @Inject(ROBOT_HEALTH_REPOSITORY) health: RobotHealthRepository,
    @Inject(FLEET_READ_REPOSITORY) fleet: FleetReadRepository,
    @Inject(ALERT_REPOSITORY) alerts: AlertRepository,
    @Inject(APP_LOGGER) logger: PortsLogger,
  ) {
    this.ingestTelemetry = new IngestTelemetry(unitOfWork, logger);
    this.listRobots = new ListRobots(robots);
    this.getRobot = new GetRobot(robots, currentState, health);
    this.listRobotTelemetry = new ListRobotTelemetry(robots, telemetry);
    this.getFleetSnapshot = new GetFleetSnapshot(fleet);
    this.listAlerts = new ListAlerts(alerts);
  }

  @Post('telemetry')
  @HttpCode(202)
  async postTelemetry(
    @Body() body: unknown,
    @Req() req: RequestWithId,
  ) {
    const parsed = IngestTelemetryRequestSchema.parse(body);
    const result = await this.ingestTelemetry.execute({
      ...parsed,
      recordedAt: new Date(parsed.recordedAt),
      requestId: req.requestId,
    });
    return {
      telemetryId: result.telemetryId,
      robotId: result.robotId,
      recordedAt: toIso(result.recordedAt),
      receivedAt: toIso(result.receivedAt),
      status: result.status,
    };
  }

  @Get('fleet')
  async getFleet() {
    const snapshot = await this.getFleetSnapshot.execute();
    return {
      robots: snapshot.robots.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        type: r.type,
        model: r.model,
        operationalStatus: r.operationalStatus,
        currentState: mapCurrentState(r.currentState),
        health: mapHealth(r.health),
      })),
    };
  }

  @Get('robots')
  async getRobots(@Query() query: Record<string, string | undefined>) {
    const parsed = ListRobotsQuerySchema.parse(query);
    const result = await this.listRobots.execute({
      type: parsed.type as import('@prc/domain').RobotType | undefined,
      status: parsed.status as
        | import('@prc/domain').RobotOperationalStatus
        | undefined,
      limit: parsed.limit,
      cursor: parsed.cursor,
    });
    return {
      items: result.items.map(({ robot, currentState }) => ({
        id: robot.id,
        displayName: robot.displayName,
        type: robot.type,
        model: robot.model,
        operationalStatus: robot.operationalStatus,
        currentState: mapCurrentState(currentState),
      })),
      page: result.page,
    };
  }

  @Get('robots/:robotId')
  async getRobotById(@Param('robotId') robotId: string) {
    const { robot, currentState, health } =
      await this.getRobot.execute(robotId);
    return {
      id: robot.id,
      displayName: robot.displayName,
      type: robot.type,
      model: robot.model,
      operationalStatus: robot.operationalStatus,
      createdAt: toIso(robot.createdAt),
      updatedAt: toIso(robot.updatedAt),
      currentState: mapCurrentState(currentState),
      health: mapHealth(health),
    };
  }

  @Get('robots/:robotId/telemetry')
  async getRobotTelemetry(
    @Param('robotId') robotId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const parsed = ListTelemetryQuerySchema.parse(query);
    const result = await this.listRobotTelemetry.execute({
      robotId,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
      limit: parsed.limit,
      cursor: parsed.cursor,
      order: parsed.order,
    });
    return {
      robotId: result.robotId,
      items: result.items.map((item) => ({
        telemetryId: item.id,
        sourceTelemetryId: item.sourceTelemetryId,
        schemaVersion: item.schemaVersion,
        position: item.position,
        batteryPercent: item.batteryPercent,
        temperatureCelsius: item.temperatureCelsius,
        signalStrengthDbm: item.signalStrengthDbm,
        velocityMetersPerSecond: item.velocityMetersPerSecond,
        headingDegrees: item.headingDegrees,
        recordedAt: toIso(item.recordedAt),
        receivedAt: toIso(item.receivedAt),
      })),
      page: result.page,
    };
  }

  @Get('alerts')
  async getAlerts(@Query() query: Record<string, string | undefined>) {
    const parsed = ListAlertsQuerySchema.parse(query);
    const result = await this.listAlerts.execute({
      robotId: parsed.robotId,
      severity: parsed.severity as import('@prc/domain').AlertSeverity | undefined,
      status: parsed.status as import('@prc/domain').AlertStatus | undefined,
      limit: parsed.limit,
      cursor: parsed.cursor,
    });
    return {
      items: result.items.map((a) => ({
        id: a.id,
        robotId: a.robotId,
        type: a.type,
        severity: a.severity,
        status: a.status,
        title: a.title,
        message: a.message,
        sourceTelemetryId: a.sourceTelemetryId,
        sourceEventId: a.sourceEventId,
        createdAt: toIso(a.createdAt),
        acknowledgedAt: a.acknowledgedAt ? toIso(a.acknowledgedAt) : null,
        acknowledgedBy: a.acknowledgedBy,
      })),
      page: result.page,
    };
  }
}
