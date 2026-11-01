import { MockWorker } from "../../src/mock-worker.js";
import { workerContract } from "./worker-contract.js";

workerContract(
  "mock",
  ({ controls }) =>
    new MockWorker({
      capabilities: { steer: controls, interrupt: controls },
      observations: [{ kind: "completed" }],
      inspected: { kind: "completed" },
    }),
);
