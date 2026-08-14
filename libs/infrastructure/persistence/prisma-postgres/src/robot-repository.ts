import {
  Robot,
  RobotOperationalStatus,
  RobotType,
} from '@prc/domain';
import {
  RobotListFilters,
  RobotListResult,
  RobotRepository,
} from '@prc/ports';
import { Prisma, PrismaClient } from '@prisma/client';
import { toDomainCurrentState, toDomainRobot } from './mappers';

type Client = PrismaClient | Prisma.TransactionClient;

export class PrismaRobotRepository implements RobotRepository {
  constructor(private readonly db: Client) {}

  async findAll(filters: RobotListFilters): Promise<RobotListResult> {
    const where: Prisma.RobotWhereInput = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.operationalStatus = filters.status;
    if (filters.cursorId) where.id = { gt: filters.cursorId };

    const rows = await this.db.robot.findMany({
      where,
      orderBy: { id: 'asc' },
      take: filters.limit + 1,
      include: { currentState: true },
    });

    const page = rows.slice(0, filters.limit);
    const hasMore = rows.length > filters.limit;

    return {
      items: page.map((row) => ({
        robot: toDomainRobot(row),
        currentState: row.currentState
          ? toDomainCurrentState(row.currentState)
          : null,
      })),
      nextCursorId: hasMore ? page[page.length - 1].id : null,
    };
  }

  async findById(robotId: string): Promise<Robot | null> {
    const row = await this.db.robot.findUnique({ where: { id: robotId } });
    return row ? toDomainRobot(row) : null;
  }

  async exists(robotId: string): Promise<boolean> {
    const row = await this.db.robot.findUnique({
      where: { id: robotId },
      select: { id: true },
    });
    return row !== null;
  }

  async lockById(robotId: string): Promise<void> {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Robot"
      WHERE "id" = ${robotId}
      FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new Error(`Robot ${robotId} does not exist`);
    }
  }
}

export type { RobotType, RobotOperationalStatus };
