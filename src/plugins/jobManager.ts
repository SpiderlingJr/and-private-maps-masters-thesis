/* Plugin that handles execution of jobs between the app and the database.
Handles the creation of jobs, updating of job state, and execution of underlying tasks.

! Can we have this implemented already?
*/

import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { JobState } from "src/entities/jobs.js";
import { Collections } from "src/entities/collections.js";
//import { PostGisConnection } from "src/util/PostGisConnection.js";

declare module "fastify" {
  interface FastifyInstance {
    jobManager: JobManager;
  }
}

// general Job type able to be executed by the jobManager
// ? this required?
type Job = () => Promise<any>;

interface JobManager {
  createJob(): Promise<string>;
  updateJob(
    jobId: string,
    state: JobState,
    colId: string,
    note?: string
  ): Promise<void>;

  executeTaskAndUbdateJob(job: () => Promise<any>): Promise<string>;
}

const jobManager: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("jobManager", {
    async createJob() {
      const jobId = await fastify.db.createJob();
      return jobId;
    },
    async updateJob(
      jobId: string,
      state: JobState,
      colId: string,
      note?: string
    ) {
      await fastify.db.updateJob(jobId, state, colId, note);
    },
    async executeTaskAndUpdateJob(
      job: () => Promise<any>,
      callback: () => void
    ) {
      const jobSuccess = await job();
    },
  });
};
