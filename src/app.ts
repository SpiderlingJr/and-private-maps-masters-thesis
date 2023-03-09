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
import performanceMeterPlugin from "./plugins/performanceMeterPlugin";
import { TransportMultiOptions } from "pino";

declare module "pino" {
  //eslint-disable-next-line @typescript-eslint/no-namespace
  namespace pino {
    interface BaseLogger {
      metric: LogFn;
    }
  }
}

const customLogLevels = {
  trace: 10,
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
        customLevels: customLogLevels,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
      level: "debug",
    },
    {
      target: "pino-pretty",
      options: {
        customLevels: customLogLevels,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        colorize: false,
        destination: `logs/${new Date()
          .toISOString()
          .substring(0, 10)}.metrics.log`,
      },
      level: "metric",
    },
  ],
  levels: customLogLevels,
} satisfies TransportMultiOptions;

const app = fastify({
  logger: {
    customLevels: customLogLevels,
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
app.register(filesPlugin);
app.register(validatorPlugin);
app.register(cacheEvictionPlugin);
app.register(performanceMeterPlugin);

// Register routes
app.register(mvtRoutes);
app.register(ogcRoutes);
app.register(crudRoutes);
app.register(styleRoutes);
app.register(cacheRoutes);
app.register(helperRoutes);

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
