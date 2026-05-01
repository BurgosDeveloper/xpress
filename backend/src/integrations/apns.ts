import fs from "fs";
import * as http2 from "http2";
import jwt from "jsonwebtoken";
import { env } from "../utils/env";

type APNsConfig = {
  authKey: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  useSandbox: boolean;
};

type SendAPNsMulticastParams = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  soundName?: string;
};

type APNsSendResponse = {
  token: string;
  ok: boolean;
  status: number;
  reason?: string;
};

const APNS_TOKEN_TTL_MS = 50 * 60 * 1000;

let cachedBearerToken: string | null = null;
let cachedBearerTokenExpiresAt = 0;

function normalizePrivateKey(raw: string) {
  return raw.replace(/\\n/g, "\n").trim();
}

function loadAuthKey(): string | null {
  if (env.APNS_AUTH_KEY_P8_B64) {
    const raw = Buffer.from(env.APNS_AUTH_KEY_P8_B64, "base64").toString("utf-8");
    return normalizePrivateKey(raw);
  }

  if (env.APNS_AUTH_KEY_P8) {
    return normalizePrivateKey(env.APNS_AUTH_KEY_P8);
  }

  if (env.APNS_AUTH_KEY_PATH) {
    const raw = fs.readFileSync(env.APNS_AUTH_KEY_PATH, "utf-8");
    return normalizePrivateKey(raw);
  }

  return null;
}

function getAPNsConfigOrNull(): APNsConfig | null {
  const authKey = loadAuthKey();
  if (!authKey) return null;
  if (!env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_BUNDLE_ID) return null;

  return {
    authKey,
    keyId: env.APNS_KEY_ID,
    teamId: env.APNS_TEAM_ID,
    bundleId: env.APNS_BUNDLE_ID,
    useSandbox: env.APNS_USE_SANDBOX,
  };
}

function getBearerToken(config: APNsConfig) {
  const now = Date.now();
  if (cachedBearerToken && now < cachedBearerTokenExpiresAt) {
    return cachedBearerToken;
  }

  cachedBearerToken = jwt.sign(
    {
      iss: config.teamId,
      iat: Math.floor(now / 1000),
    },
    config.authKey,
    {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: config.keyId,
      },
    }
  );
  cachedBearerTokenExpiresAt = now + APNS_TOKEN_TTL_MS;
  return cachedBearerToken;
}

function buildPayload(params: Omit<SendAPNsMulticastParams, "tokens">) {
  const aps: Record<string, unknown> = {
    alert: {
      title: params.title,
      body: params.body,
    },
  };

  if (params.soundName) {
    aps.sound = `${params.soundName}.mp3`;
  }

  return {
    aps,
    ...(params.data ?? {}),
  };
}

async function sendSingleAPNsNotification(params: {
  client: http2.ClientHttp2Session;
  bearerToken: string;
  config: APNsConfig;
  token: string;
  payload: Record<string, unknown>;
}) {
  return new Promise<APNsSendResponse>((resolve) => {
    let status = 0;
    let body = "";

    const request = params.client.request({
      ":method": "POST",
      ":path": `/3/device/${params.token}`,
      authorization: `bearer ${params.bearerToken}`,
      "apns-topic": params.config.bundleId,
      "apns-priority": "10",
      "apns-push-type": "alert",
    });

    request.setEncoding("utf8");
    request.on("response", (headers) => {
      const rawStatus = headers[http2.constants.HTTP2_HEADER_STATUS];
      status = typeof rawStatus === "number" ? rawStatus : Number(rawStatus ?? 0);
    });
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      if (status >= 200 && status < 300) {
        resolve({ token: params.token, ok: true, status });
        return;
      }

      let reason: string | undefined;
      if (body.trim()) {
        try {
          const parsed = JSON.parse(body) as { reason?: unknown };
          if (typeof parsed.reason === "string" && parsed.reason.trim()) {
            reason = parsed.reason.trim();
          }
        } catch {
          reason = body.trim();
        }
      }

      resolve({ token: params.token, ok: false, status, reason });
    });
    request.on("error", (error) => {
      resolve({ token: params.token, ok: false, status: 0, reason: error.message || "APNS_REQUEST_ERROR" });
    });

    request.write(JSON.stringify(params.payload));
    request.end();
  });
}

export async function sendAPNsMulticast(params: SendAPNsMulticastParams) {
  const config = getAPNsConfigOrNull();
  if (!config) {
    return {
      configured: false,
      successCount: 0,
      failureCount: params.tokens.length,
      responses: params.tokens.map<APNsSendResponse>((token) => ({
        token,
        ok: false,
        status: 0,
        reason: "APNS_NOT_CONFIGURED",
      })),
    };
  }

  const client = http2.connect(
    config.useSandbox ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com"
  );
  const payload = buildPayload(params);
  const bearerToken = getBearerToken(config);

  try {
    const responses: APNsSendResponse[] = [];
    for (const token of params.tokens) {
      responses.push(
        await sendSingleAPNsNotification({
          client,
          bearerToken,
          config,
          token,
          payload,
        })
      );
    }

    const successCount = responses.filter((response) => response.ok).length;
    return {
      configured: true,
      successCount,
      failureCount: responses.length - successCount,
      responses,
    };
  } finally {
    client.close();
  }
}