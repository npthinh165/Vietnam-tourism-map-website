import type { Prisma, RewardEvent } from "@prisma/client";
import { DAILY_CAPS, REWARDS, tierFor, vietnamDay } from "../shared/travel.ts";

// Called only inside the transaction that commits the eligible action.
export async function awardPoints(
  tx: Prisma.TransactionClient,
  userId: string,
  event: RewardEvent,
  source: string,
) {
  const entries = await tx.pointEntry.createMany({
    data: [{ userId, event, source, amount: 0 }],
    skipDuplicates: true,
  });
  if (!entries.count) return 0;
  const day = vietnamDay();
  const quota = await tx.rewardQuota.upsert({
    where: { userId_event_day: { userId, event, day } },
    create: { userId, event, day, count: 1 },
    update: { count: { increment: 1 } },
  });
  const amount = quota.count <= DAILY_CAPS[event] ? REWARDS[event] : 0;
  if (amount) {
    await tx.pointEntry.update({
      where: { userId_event_source: { userId, event, source } },
      data: { amount },
    });
    const user = await tx.user.update({
      where: { id: userId },
      data: { points: { increment: amount } },
    });
    await tx.user.update({
      where: { id: userId },
      data: { tier: tierFor(user.points).key },
    });
  }
  return amount;
}
