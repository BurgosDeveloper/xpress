import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db/prisma";
import { computeBboxFromGeoJson } from "../modules/zones/zones.service";

function usageAndExit() {
  // eslint-disable-next-line no-console
  console.log("Uso: tsx src/scripts/importZones.ts [zonesDir]\n\n" +
    "- zonesDir: carpeta con archivos .geojson/.json (default: ../json/zones)\n" +
    "- Convención opcional: si el archivo empieza con 'hub__', la zona se crea como hub (SC).\n" +
    "  Ej: hub__san_cristobal.geojson");
  process.exit(1);
}

type ImportFeature = { geometry: any; properties?: any };

function extractPolygonGeometries(input: any): ImportFeature[] {
  if (!input || typeof input !== "object") return [];

  if (input.type === "Polygon" || input.type === "MultiPolygon") {
    return [{ geometry: input }];
  }

  if (input.type === "Feature" && input.geometry) {
    const g = input.geometry;
    if (g?.type === "Polygon" || g?.type === "MultiPolygon") {
      return [{ geometry: g, properties: input.properties }];
    }
  }

  if (input.type === "FeatureCollection" && Array.isArray(input.features)) {
    const out: ImportFeature[] = [];
    for (const f of input.features) {
      if (!f || f.type !== "Feature" || !f.geometry) continue;
      const g = f.geometry;
      if (g?.type === "Polygon" || g?.type === "MultiPolygon") {
        out.push({ geometry: g, properties: f.properties });
      }
    }
    return out;
  }

  return [];
}

function parseIsHubFromProperties(properties: any): boolean | null {
  if (!properties || typeof properties !== "object") return null;
  const direct = properties.isHub ?? properties.hub ?? properties.is_hub;
  if (typeof direct === "boolean") return direct;
  if (typeof direct === "number") return direct === 1;
  if (typeof direct === "string") {
    const v = direct.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(v)) return true;
    if (["false", "0", "no", "n"].includes(v)) return false;
  }

  const role = properties.role ?? properties.kind ?? properties.type;
  if (typeof role === "string" && role.trim().toLowerCase() === "hub") return true;

  return null;
}

function guessNameFromFilename(file: string) {
  const base = path.basename(file).replace(/\.(geojson|json)$/i, "");
  return base.replace(/^hub__/, "").replace(/[_-]+/g, " ").trim();
}

async function main() {
  const arg = process.argv[2];
  const zonesDir = arg ? path.resolve(process.cwd(), arg) : path.resolve(__dirname, "..", "..", "..", "json", "zones");

  if (!fs.existsSync(zonesDir) || !fs.statSync(zonesDir).isDirectory()) {
    // eslint-disable-next-line no-console
    console.error("No existe la carpeta:", zonesDir);
    usageAndExit();
  }

  const files = fs
    .readdirSync(zonesDir)
    .filter((f) => /\.(geojson|json)$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    // eslint-disable-next-line no-console
    console.error("No hay archivos .geojson/.json en:", zonesDir);
    usageAndExit();
  }

  for (const file of files) {
    const full = path.join(zonesDir, file);
    const raw = fs.readFileSync(full, "utf8");
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // eslint-disable-next-line no-console
      console.warn("Saltando (JSON inválido):", file);
      continue;
    }

    const features = extractPolygonGeometries(parsed);
    if (!features.length) {
      // eslint-disable-next-line no-console
      console.warn("Saltando (no hay Polygon/MultiPolygon):", file);
      continue;
    }

    const fileDefaultHub = /^hub__/i.test(path.basename(file));
    const baseName = guessNameFromFilename(file);

    for (let idx = 0; idx < features.length; idx++) {
      const { geometry, properties } = features[idx];

      const propName = properties?.name ? String(properties.name).trim() : "";
      const name = propName || (features.length === 1 ? baseName : `${baseName} ${idx + 1}`);

      const propIsHub = parseIsHubFromProperties(properties);
      const isHub = propIsHub ?? fileDefaultHub;

      let bbox;
      try {
        bbox = computeBboxFromGeoJson(geometry);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.warn("Saltando (bbox inválido):", file, name, e?.message);
        continue;
      }

      const existing = await prisma.zone.findFirst({ where: { name } });

      if (existing) {
        await prisma.zone.update({
          where: { id: existing.id },
          data: {
            isHub,
            isActive: true,
            geojson: geometry,
            minLat: bbox.minLat,
            minLng: bbox.minLng,
            maxLat: bbox.maxLat,
            maxLng: bbox.maxLng,
          },
        });
        // eslint-disable-next-line no-console
        console.log("Actualizada zona:", name, isHub ? "(hub)" : "");
      } else {
        await prisma.zone.create({
          data: {
            name,
            isHub,
            isActive: true,
            geojson: geometry,
            minLat: bbox.minLat,
            minLng: bbox.minLng,
            maxLat: bbox.maxLat,
            maxLng: bbox.maxLng,
          },
        });
        // eslint-disable-next-line no-console
        console.log("Creada zona:", name, isHub ? "(hub)" : "");
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("importZones error:", err);
  process.exit(1);
});
