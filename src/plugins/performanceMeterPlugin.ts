/**
 * Plugin that starts timers for tasks and waits for their completion, then logs the
 * execution time.
 * requires a running fastify log plugin
 */

import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    performanceMeter: PerformanceMeter;
  }
}
interface PerformanceMeter {
  startTimer: (name: string) => { stop: (success: boolean) => number };
  stopTimer: (name: string, success: boolean) => void;
  runTask: (name: string, task: () => Promise<void>) => Promise<void>;
}

const performanceMeterPlugin: FastifyPluginAsync = async (fastify) => {
  const timers = new Map<string, ReturnType<typeof timer>>();

  const timer = (name: string) => {
    const start = Date.now();
    return {
      stop: (success: boolean) => {
        const end = Date.now();
        const duration = end - start;
        fastify.log.metric(
          `timer ${name} took ${end - start}ms as ${
            success ? "success" : "failure"
          }`
        );

        if (!timers.delete(name)) fastify.log.warn(`timer ${name} not found`);

        return duration;
      },
    };
  };

  fastify.decorate("performanceMeter", {
    startTimer: (name: string) => {
      fastify.log.metric(`starting timer ${name}`);
      const t = timer(name);
      timers.set(name, t);
      return t;
    },
    stopTimer: (name: string, success: boolean) => {
      const t = timers.get(name);
      if (t) {
        t.stop(success);
      } else {
        fastify.log.metric(`timer ${name} not found`);
      }
    },
    runTask: async (name: string, task: () => Promise<void>) => {
      console.log(`starting task ${name}`);
      await task();
      console.log(`stopping task ${name}`);
    },
  } satisfies PerformanceMeter);

  fastify.addHook("onClose", async () => {
    console.log("stopping filesPlugin");
    if (timers.size > 0) {
      fastify.log.warn(
        `performanceMeterPlugin closing with ${timers.size} active timers`
      );
      fastify.log.warn(`active timers: ${Array.from(timers.keys())}`);
    }
  });
};

export default fp(performanceMeterPlugin);
