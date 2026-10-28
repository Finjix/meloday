export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recoverInterruptedJobs } = await import("./server/db");
    recoverInterruptedJobs();
  }
}
