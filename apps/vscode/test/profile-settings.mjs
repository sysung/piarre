export const isolatedSettings = {
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false,
  "telemetry.telemetryLevel": "off",
  "chat.disableAIFeatures": true,
  "window.restoreWindows": "none",
};

export function assertGuiTestsAllowed() {
  if (process.platform === "darwin" && process.env.CI !== "true" && process.env.PIARRE_GUI_TESTS !== "1") {
    throw new Error("This test opens a VS Code window. Set PIARRE_GUI_TESTS=1 only for an intentional local GUI verification run.");
  }
}
