import { JobState } from "../../src/entities/jobs";
import { app } from "../../src/app.js";

async function getJobState(jobId: string) {
  const jobResponse = await app.inject({
    method: "GET",
    url: `/job/${jobId}`,
  });
  if (JSON.parse(jobResponse.body).job_state === JobState.PENDING)
    throw new Error("PENDING");
  return jobResponse;
}
/**
 * Tries to receive metadata from a performed job. If the job is not yet complete, it retries up to maxRetries times.
 * @param jobId id of the job to wait for completion
 * @param interval retry-interval in ms, default 1000
 * @param maxRetries number of maximum retries, default 5
 * @returns job info response
 */
async function awaitJobCompletion(
  jobId: string,
  interval = 2000,
  maxRetries = 60
) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const jobResponse = await getJobState(jobId);
      return jobResponse;
    } catch (error) {
      if (error.message !== "PENDING") {
        throw error;
      }
      retries++;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  throw new Error(`Max retries (${maxRetries}) exceeded`);
}

export { awaitJobCompletion };
