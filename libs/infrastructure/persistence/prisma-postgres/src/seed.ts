import { PrismaClient, RobotOperationalStatus, RobotType } from '@prisma/client';

const robots = [
  {
    id: 'D-04',
    displayName: 'D-04',
    type: RobotType.DRONE,
    model: 'AX-4 Survey Drone',
    operationalStatus: RobotOperationalStatus.ACTIVE,
  },
  {
    id: 'H-17',
    displayName: 'H-17',
    type: RobotType.HAULER,
    model: 'HX-9 Heavy Transport',
    operationalStatus: RobotOperationalStatus.IDLE,
  },
  {
    id: 'W-08',
    displayName: 'W-08',
    type: RobotType.WORKER,
    model: 'WX-3 Utility Droid',
    operationalStatus: RobotOperationalStatus.ACTIVE,
  },
  {
    id: 'M-12',
    displayName: 'M-12',
    type: RobotType.MINER,
    model: 'MX-7 Excavation Unit',
    operationalStatus: RobotOperationalStatus.CHARGING,
  },
  {
    id: 'S-03',
    displayName: 'S-03',
    type: RobotType.SCOUT,
    model: 'SX-2 Recon Rover',
    operationalStatus: RobotOperationalStatus.IDLE,
  },
] as const;

export async function seedRobots(prisma: PrismaClient): Promise<void> {
  for (const robot of robots) {
    await prisma.robot.upsert({
      where: { id: robot.id },
      create: { ...robot },
      update: {
        displayName: robot.displayName,
        type: robot.type,
        model: robot.model,
        operationalStatus: robot.operationalStatus,
      },
    });
  }
}
