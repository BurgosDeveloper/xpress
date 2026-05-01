import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import { getCloudinaryConfig, isCloudinaryEnabled } from "../../integrations/cloudinary";

export async function uploadController(req: Request, res: Response) {
  const file = req.file;
  if (!file) return res.status(400).json({ message: "Missing file" });

  const category = String((req.body as any)?.category ?? "general").toLowerCase();
  const forbidden = new Set(["driver_license", "vehicle_cert"]);
  if (forbidden.has(category)) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // ignore
    }
    return res.status(400).json({ message: "Categoría de upload no permitida" });
  }

  // Producción (Railway): subir a Cloudinary si está configurado
  if (isCloudinaryEnabled()) {
    const cfg = getCloudinaryConfig();
    if (!cfg) return res.status(500).json({ message: "Uploads no configurados" });

    cloudinary.config({
      cloud_name: cfg.cloud_name,
      api_key: cfg.api_key,
      api_secret: cfg.api_secret,
      secure: true,
    });

    const userId = (req as any).user?.id as string | undefined;
    const safeCategory = category.replace(/[^a-z0-9_-]/g, "_");
    const folder = `${cfg.folder}/${userId ?? "anonymous"}/${safeCategory}`;

    const buffer: Buffer | undefined = (file as any).buffer;
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return res.status(400).json({ message: "Missing file buffer" });
    }

    const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "auto",
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result?.secure_url) return reject(new Error("Upload failed"));
          resolve({ secure_url: result.secure_url });
        }
      );

      Readable.from(buffer).pipe(stream);
    });

    return res.status(201).json({
      ok: true,
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: uploaded.secure_url,
      },
    });
  }

  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const rel = path.relative(uploadsRoot, file.path).replace(/\\/g, "/");
  const urlPath = `/uploads/${rel}`;

  return res.status(201).json({
    ok: true,
    file: {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: urlPath,
    },
  });
}
