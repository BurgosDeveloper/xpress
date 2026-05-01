import { RatingDirection, UserRole } from "@prisma/client";
import { prisma } from "../../db/prisma";

export async function createRating(params: {
  userId: string;
  role: "USER" | "DRIVER" | "ADMIN";
  rideId: string;
  stars: number;
  comment?: string;
}) {
  if (params.role === UserRole.ADMIN) {
    return { ok: false as const, error: "Admin cannot rate" };
  }

  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    include: { passenger: { select: { userId: true } }, matchedDriver: { select: { userId: true } } },
  });

  if (!ride) return { ok: false as const, error: "Ride not found" };
  if (!ride.matchedDriver) return { ok: false as const, error: "Ride has no matched driver" };

  let direction: RatingDirection;
  let fromUserId = params.userId;
  let toUserId: string;

  if (params.role === UserRole.USER) {
    if (ride.passenger.userId !== params.userId) return { ok: false as const, error: "Forbidden" };
    direction = RatingDirection.PASSENGER_TO_DRIVER;
    toUserId = ride.matchedDriver.userId;
  } else {
    if (ride.matchedDriver.userId !== params.userId) return { ok: false as const, error: "Forbidden" };
    direction = RatingDirection.DRIVER_TO_PASSENGER;
    toUserId = ride.passenger.userId;
  }

  try {
    const rating = await prisma.rating.create({
      data: {
        rideId: ride.id,
        direction,
        fromUserId,
        toUserId,
        stars: params.stars,
        comment: params.comment,
      },
    });

    return { ok: true as const, rating };
  } catch {
    return { ok: false as const, error: "Rating already submitted" };
  }
}

export async function listMyRatings(params: { userId: string; direction?: string }) {
  const where: any = { toUserId: params.userId };
  if (params.direction === "SENT") {
    delete where.toUserId;
    where.fromUserId = params.userId;
  }

  return prisma.rating.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
