import type { Request, Response } from "express";
import { buildWhatsappLink } from "../../utils/whatsapp";
import { prisma } from "../../db/prisma";

export async function adminListPasswordResetsController(req: Request, res: Response) {
  const take = req.query.take ? Math.min(100, Math.max(1, Number(req.query.take))) : 50;

  const rows = await prisma.passwordResetRequest.findMany({
    take,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true, role: true } } },
  });

  return res.status(200).json({
    ok: true,
    requests: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.user.email,
      role: r.user.role,
      phoneLast3: r.phoneLast3,
      code: r.code,
      sentAt: r.sentAt,
      verifiedAt: r.verifiedAt,
      consumedAt: r.consumedAt,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    })),
  });
}

export async function adminSendPasswordResetWhatsappController(req: Request, res: Response) {
  const { resetRequestId } = req.params;

  const row = await prisma.passwordResetRequest.findUnique({
    where: { id: resetRequestId },
  });
  if (!row) return res.status(404).json({ message: "Request not found" });

  const whatsappLink = buildWhatsappLink({
    phoneRaw: row.phoneRaw,
    text: `Código de recuperación Xpress Traslados: ${row.code}`,
  });

  await prisma.passwordResetRequest.update({
    where: { id: row.id },
    data: { sentAt: new Date() },
  });

  return res.status(200).json({ ok: true, whatsappLink });
}
