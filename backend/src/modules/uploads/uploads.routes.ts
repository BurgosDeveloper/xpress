import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../../middlewares/auth.middleware";
import { uploadController } from "./uploads.controller";
import { isCloudinaryEnabled } from "../../integrations/cloudinary";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = (req as any).user?.id as string | undefined;
    const category = String((req.body?.category ?? "general")).toLowerCase();
    const safeCategory = category.replace(/[^a-z0-9_-]/g, "_");

    const base = path.resolve(process.cwd(), "uploads");
    const dest = path.join(base, userId ?? "anonymous", safeCategory);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : "";
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`;
    cb(null, name);
  },
});

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: isCloudinaryEnabled() ? memoryStorage : diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);
uploadsRouter.post("/single", upload.single("file"), uploadController);
