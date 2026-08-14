import {
  GetRobot,
  IngestTelemetry,
  ListRobotTelemetry,
  ListRobots,
} from '@prc/application';
import {
  IngestTelemetryRequestSchema,
  ListRobotsQuerySchema,
  ListTelemetryQuerySchema,
} from '@prc/contracts';
import {
  RobotCurrentStateRepository,
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
  APP_LOGGER,
  ROBOT_CURRENT_STATE_REPOSITORY,
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

@Controller()
export class ApiController {
  private readonly ingestTelemetry: IngestTelemetry;
  private readonly listRobots: ListRobots;
  private readonly getRobot: GetRobot;
  private readonly listRobotTelemetry: ListRobotTelemetry;

  constructor(
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(ROBOT_REPOSITORY) robots: RobotRepository,
    @Inject(ROBOT_CURRENT_STATE_REPOSITORY)
    currentState: RobotCurrentStateRepository,
    @Inject(ROBOT_TELEMETRY_REPOSITORY) telemetry: RobotTelemetryRepository,
    @Inject(APP_LOGGER) logger: PortsLogger,
  ) {
    this.ingestTelemetry = new IngestTelemetry(unitOfWork, logger);
    this.listRobots = new ListRobots(robots);
    this.getRobot = new GetRobot(robots, currentState);
    this.listRobotTelemetry = new ListRobotTelemetry(robots, telemetry);
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
    const { robot, currentState } = await this.getRobot.execute(robotId);
    return {
      id: robot.id,
      displayName: robot.displayName,
      type: robot.type,
      model: robot.model,
      operationalStatus: robot.operationalStatus,
      createdAt: toIso(robot.createdAt),
      updatedAt: toIso(robot.updatedAt),
      currentState: mapCurrentState(currentState),
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
}
