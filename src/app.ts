import { fastify } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import closeWithGrace from "close-with-grace";

//import autoload from "@fastify/autoload";
//import { fileURLToPath } from "url";
//import { dirname, join } from "path";

import cachePlugin from "./plugins/cachePlugin";
import dbPlugin from "./plugins/dbPlugin";

import helperRoutes from "./routes/helpers";
import ogcRoutes from "./routes/ogc";
import cacheRoutes from "./routes/cache";
import crudRoutes from "./routes/crud";
import styleRoutes from "./routes/style";
import mvtRoutes from "./routes/mvt";
import validatorPlugin from "./plugins/validatorPlugin";
import filesPlugin from "./plugins/filesPlugin";
import cacheEvictionPlugin from "./plugins/cacheEvictionPlugin";

// Instantiate Fastify with some config
const app = fastify({
  logger: {
    transport:
      process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    level:
      process.env.DEBUG != null
        ? "debug"
        : process.env.NODE_ENV === "test"
        ? "error"
        : "info",
  },
}).withTypeProvider<TypeBoxTypeProvider>();

//TODO How to get autoload to work? fails to import cache.
/*
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.register(autoload, {
  dir: join(__dirname, "./routes"),
});

app.register(autoload, {
  dir: join(__dirname, "./plugins"),
});
*/

// Register plugins
app.register(cachePlugin, {
  strategy: process.env.STRATEGY as "memory" | "redis" | undefined,
});
app.register(dbPlugin);
app.register(validatorPlugin);
app.register(filesPlugin);
app.register(cacheEvictionPlugin);

// Register routes
app.register(helperRoutes);
app.register(ogcRoutes);
app.register(cacheRoutes);
app.register(crudRoutes);
app.register(styleRoutes);
app.register(mvtRoutes);

const handler: closeWithGrace.CloseWithGraceAsyncCallback = async ({ err }) => {
  if (err) {
    app.log.error(err);
  }
  await app.close();
};

// delay is the number of milliseconds for the graceful close to finish
const closeListeners = closeWithGrace(
  {
    delay: parseInt(process.env.FASTIFY_CLOSE_GRACE_DELAY || "") || 500,
  },
  handler
);

app.addHook("onClose", (instance, done) => {
  closeListeners.uninstall();
  done();
});

export { app };
