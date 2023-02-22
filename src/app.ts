import { fastify } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import closeWithGrace from "close-with-grace";

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
import { TransportMultiOptions } from "pino";

// Instantiate Fastify with some config

declare module "pino" {
  //eslint-disable-next-line @typescript-eslint/no-namespace
  namespace pino {
    interface BaseLogger {
      metric: LogFn;
    }
  }
}

const customLevels = {
  info: 30,
  debug: 35,
  warn: 40,
  error: 50,
  fatal: 60,
  metric: 99,
};

const loggerTransports = {
  targets: [
    {
      target: "pino-pretty",
      options: {
        customLevels: customLevels,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
      level: "info",
    },
    {
      target: "pino-pretty",
      options: {
        customLevels: customLevels,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        colorize: false,
        destination: "logs/metric.log",
      },
      level: "metric",
    },
  ],
  levels: customLevels,
} satisfies TransportMultiOptions;

const app = fastify({
  logger: {
    customLevels: customLevels,
    useOnlyCustomLevels: true,
    transport:
      process.env.NODE_ENV !== "production" ? loggerTransports : undefined,
  },
}).withTypeProvider<TypeBoxTypeProvider>();

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
