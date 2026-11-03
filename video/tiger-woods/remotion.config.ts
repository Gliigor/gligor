import fs from "node:fs";
import { Config } from "@remotion/cli/config";

// In the build container a pre-installed headless Chromium is used (no download); elsewhere Remotion fetches its own.
const CONTAINER_CHROME = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (fs.existsSync(CONTAINER_CHROME)) Config.setBrowserExecutable(CONTAINER_CHROME);
// "angle" for a desktop GPU; the CLI flag --gl=swangle selects software WebGL (used in the container)
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
