/* global console, process, document */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
const file = path.resolve("demo/CivicSync_Hackathon_Demo.mp4");
if (!fs.existsSync(file))
  throw new Error("Final MP4 does not exist; recording is not complete.");
const size = fs.statSync(file).size;
const out = process.env.CIVICSYNC_RECORDING_DIR || "demo/.work";
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  if (req.url !== "/video") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      '<body style="margin:0;background:#101c2b"><video style="width:1920px;height:1080px" src="/video" preload="auto"></video>',
    );
    return;
  }
  const range = req.headers.range;
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (!match) {
      res.writeHead(416);
      res.end();
      return;
    }
    const start = Number(match[1]),
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    res.writeHead(206, {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
    });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": size,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(file).pipe(res);
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await page.goto("http://127.0.0.1:" + server.address().port);
  const metadata = await page.evaluate(async () => {
    const v = document.querySelector("video");
    if (v.readyState < 1)
      await new Promise((resolve, reject) => {
        v.onloadedmetadata = resolve;
        v.onerror = reject;
      });
    return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
  });
  if (
    metadata.width !== 1920 ||
    metadata.height !== 1080 ||
    metadata.duration < 120 ||
    metadata.duration > 300
  )
    throw new Error("Video metadata does not meet submission requirements");
  for (const [i, t] of [
    5,
    25,
    50,
    75,
    100,
    130,
    150,
    metadata.duration - 2,
  ].entries()) {
    await page.evaluate(async (time) => {
      const v = document.querySelector("video");
      await new Promise((resolve, reject) => {
        v.onseeked = resolve;
        v.onerror = reject;
        v.currentTime = time;
      });
    }, t);
    await page.screenshot({
      path: path.join(out, "review-" + String(i + 1).padStart(2, "0") + ".png"),
    });
  }
  const result = {
    ...metadata,
    bytes: size,
    MiB: Number((size / 1048576).toFixed(2)),
    decodedFrames: 8,
  };
  fs.writeFileSync(
    path.join(out, "video-verification.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
