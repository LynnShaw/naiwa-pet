import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";

const [input = "naiwa.mp4", output = "public/pets/naiwa"] = process.argv.slice(2);

const config = {
  id: basename(output),
  name: "Naiwa",
  fps: 30,
  width: 720,
  height: 960,
  keyColor: "0xffffff",
  similarity: 0.08,
  blend: 0.03,
  webpQuality: 82
};

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });

await rm(output, { recursive: true, force: true });
await mkdir(join(output, "frames"), { recursive: true });
await mkdir(join(output, ".tmp-png"), { recursive: true });

await run("ffmpeg", ["-y", "-i", input, "-vn", "-c:a", "copy", join(output, "audio.m4a")]);

const pngPattern = join(output, ".tmp-png", "frame_%04d.png");
const filter = [
  `fps=${config.fps}`,
  `scale=${config.width}:${config.height}:flags=lanczos`,
  `colorkey=${config.keyColor}:${config.similarity}:${config.blend}`,
  "format=rgba"
].join(",");

await run("ffmpeg", [
  "-y",
  "-i",
  input,
  "-an",
  "-vf",
  filter,
  "-start_number",
  "0",
  pngPattern
]);

const pngFrames = (await readdir(join(output, ".tmp-png"))).filter((file) => file.endsWith(".png")).sort();
for (const file of pngFrames) {
  const source = join(output, ".tmp-png", file);
  const target = join(output, "frames", file.replace(".png", ".webp"));
  await run("cwebp", ["-quiet", "-q", String(config.webpQuality), source, "-o", target]);
}

await rm(join(output, ".tmp-png"), { recursive: true, force: true });

const frameCount = (await readdir(join(output, "frames"))).filter((file) => file.endsWith(".webp")).length;
if (!Number.isFinite(frameCount) || frameCount <= 0) {
  throw new Error("Unable to determine frame count");
}

const manifest = {
  id: config.id,
  name: config.name,
  width: config.width,
  height: config.height,
  fps: config.fps,
  frameCount,
  idleFrame: "frames/frame_0000.webp",
  framePattern: "frames/frame_{index}.webp",
  audio: "audio.m4a"
};

await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generated ${frameCount} frames in ${output}`);
