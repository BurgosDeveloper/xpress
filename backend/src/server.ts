import { createApp } from "./app";
import { env } from "./utils/env";
import { createServer } from "http";
import { initRealtime } from "./realtime/realtime";

const app = createApp();

const server = createServer(app);
initRealtime(server);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});
