import path from "node:path";
import Mocha from "mocha";

export function run(): Promise<void> {
  const mocha = new Mocha({ color: true, ui: "tdd" });
  mocha.addFile(path.resolve(__dirname, "activation.test.js"));

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
