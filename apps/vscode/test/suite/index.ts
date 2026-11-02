import path from "node:path";
import Mocha from "mocha";

export function run(): Promise<void> {
  const mocha = new Mocha({ color: true, ui: "tdd" });
  if (process.env.PIARRE_UNTRUSTED_TEST === "1") {
    mocha.addFile(path.resolve(__dirname, "untrusted.test.js"));
  } else if (process.env.PIARRE_PACKAGE_TEST === "1") {
    mocha.addFile(path.resolve(__dirname, "activation.test.js"));
  } else {
    mocha.addFile(path.resolve(__dirname, "activation.test.js"));
    mocha.addFile(path.resolve(__dirname, "project.test.js"));
    mocha.addFile(path.resolve(__dirname, "proposal.test.js"));
    mocha.addFile(path.resolve(__dirname, "foundations.test.js"));
    mocha.addFile(path.resolve(__dirname, "context.test.js"));
    mocha.addFile(path.resolve(__dirname, "costs.test.js"));
    mocha.addFile(path.resolve(__dirname, "provider-settings.test.js"));
    mocha.addFile(path.resolve(__dirname, "workspace.test.js"));
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
