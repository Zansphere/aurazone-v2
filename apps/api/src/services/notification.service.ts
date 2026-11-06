import { prisma, type Prisma } from "@aurazone/database";

export interface StaffNotificationPayload {
  storeIds?: string[];
  title: string;
  body: string;
  url?: string | null;
}

/**
 * Creates in-app notifications for SUPER_ADMINs and relevant STORE_MANAGERs.
 */
export async function createStaffNotification(
  tx: Prisma.TransactionClient | typeof prisma,
  opts: StaffNotificationPayload
): Promise<number> {
  try {
    if (!tx || !tx.user?.findMany) return 0;

    const superAdmins =
      (await tx.user.findMany({
        where: { role: "SUPER_ADMIN" },
        select: { id: true },
      })) ?? [];

    let storeManagers: Array<{ id: string }> = [];
    if (opts.storeIds && opts.storeIds.length > 0) {
      storeManagers =
        (await tx.user.findMany({
          where: {
            role: "STORE_MANAGER",
            managedStores: { some: { storeId: { in: opts.storeIds } } },
          },
          select: { id: true },
        })) ?? [];
    } else {
      storeManagers =
        (await tx.user.findMany({
          where: { role: "STORE_MANAGER" },
          select: { id: true },
        })) ?? [];
    }

    const uniqueUserIds = Array.from(
      new Set([
        ...(Array.isArray(superAdmins) ? superAdmins.map((u) => u.id) : []),
        ...(Array.isArray(storeManagers) ? storeManagers.map((u) => u.id) : []),
      ])
    ).filter(Boolean);

    if (uniqueUserIds.length === 0) return 0;

    if (tx.notificationHistory?.createMany) {
      await tx.notificationHistory.createMany({
        data: uniqueUserIds.map((userId) => ({
          userId,
          title: opts.title,
          body: opts.body,
          url: opts.url ?? null,
        })),
      });
    } else if (tx.notificationHistory?.create) {
      for (const userId of uniqueUserIds) {
        await tx.notificationHistory.create({
          data: {
            userId,
            title: opts.title,
            body: opts.body,
            url: opts.url ?? null,
          },
        });
      }
    }

    return uniqueUserIds.length;
  } catch (err) {
    console.error("[NotificationService] Failed to create staff notification:", err);
    return 0;
  }
}
