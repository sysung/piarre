import path from "node:path";
import { readdirSync } from "node:fs";
import Mocha from "mocha";

export function run(): Promise<void> {
  const mocha = new Mocha({ color: true, ui: "tdd" });
  if (process.env.PIARRE_UNTRUSTED_TEST === "1") {
    mocha.addFile(path.resolve(__dirname, "untrusted.test.js"));
  } else if (process.env.PIARRE_PACKAGE_TEST === "1") {
    mocha.addFile(path.resolve(__dirname, "activation.test.js"));
  } else if (process.env.PIARRE_DETAIL_TEST === "1") {
    mocha.addFile(path.resolve(__dirname, "detail-identity.test.js"));
  } else if (process.env.PIARRE_RESULT_REVIEW_TEST === "1") {
    mocha.addFile(path.resolve(__dirname, "result-review.test.js"));
    mocha.addFile(path.resolve(__dirname, "execution-coordinator.test.js"));
    mocha.addFile(path.resolve(__dirname, "recovery.test.js"));
    mocha.addFile(path.resolve(__dirname, "workspace-integration.test.js"));
  } else if (process.env.PIARRE_LIFETIME_TEST === "1") {
    mocha.addFile(path.resolve(__dirname, "project-lifetime.test.js"));
    mocha.addFile(path.resolve(__dirname, "execution-coordinator.test.js"));
    mocha.addFile(path.resolve(__dirname, "recovery.test.js"));
  } else {
    for (const name of readdirSync(__dirname).filter((name) => name.endsWith(".test.js") && name !== "untrusted.test.js").sort()) {
      mocha.addFile(path.resolve(__dirname, name));
    }
  }

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures === 0) {
        resolve();
      } else {
        reject(new Error(`${String(failures)} smoke test(s) failed`));
      }
    });
  });
}
