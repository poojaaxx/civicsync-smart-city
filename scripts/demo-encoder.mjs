/* global document, window, createImageBitmap, fetch, MediaRecorder, Blob, FileReader, URL, console, process, setTimeout */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { Buffer } from "node:buffer";
export const SITE = "https://civicsync-smart-city.vercel.app";
export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export async function createEncoder(browser) {
  const encoder = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await encoder.setContent('<canvas width="1920" height="1080"></canvas>');
  await encoder.evaluate(() => {
    const canvas = document.querySelector("canvas"),
      chunks = [];
    const type = "video/mp4;codecs=avc1.42E01E";
    if (!MediaRecorder.isTypeSupported(type))
      throw new Error("This browser cannot export H.264 MP4");
    const recorder = new MediaRecorder(canvas.captureStream(15), {
      mimeType: type,
      videoBitsPerSecond: 1800000,
    });
    window.videoRecorder = { canvas, recorder, chunks };
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.start(1000);
  });
  return {
    async frame(page, caption) {
      const masks = [
        page.locator(".account-identity"),
        page.locator('input[type="email"]'),
        page.locator('input[type="password"]'),
        page
          .locator(".conflict-card")
          .filter({ hasNotText: "[ILLUSTRATIVE DEMO" }),
      ];
      const image = await page.screenshot({
        type: "jpeg",
        quality: 85,
        mask: masks,
        maskColor: "#13283c",
        animations: "allow",
      });
      await encoder.evaluate(
        async ({ image, caption }) => {
          const bitmap = await createImageBitmap(
            await (await fetch("data:image/jpeg;base64," + image)).blob(),
          );
          const ctx = window.videoRecorder.canvas.getContext("2d");
          ctx.drawImage(bitmap, 0, 0, 1920, 1080);
          bitmap.close();
          ctx.fillStyle = "rgba(9,25,43,0.94)";
          ctx.fillRect(0, 948, 1920, 132);
          ctx.fillStyle = "#65e0ca";
          ctx.font = "bold 22px Arial";
          ctx.fillText(
            "CIVICSYNC  |  LIVE APPLICATION  |  ILLUSTRATIVE TEST RECORDS",
            60,
            983,
          );
          ctx.fillStyle = "white";
          ctx.font = "30px Arial";
          const words = caption.split(" ");
          let line = "",
            y = 1028;
          for (const word of words) {
            if (ctx.measureText(line + word).width > 1780) {
              ctx.fillText(line, 60, y);
              line = "";
              y += 37;
            }
            line += word + " ";
          }
          ctx.fillText(line, 60, y);
        },
        { image: image.toString("base64"), caption },
      );
    },
    async finish(file) {
      const result = await encoder.evaluate(async () => {
        const { recorder, chunks } = window.videoRecorder;
        await new Promise((resolve) => {
          recorder.onstop = resolve;
          recorder.stop();
        });
        const blob = new Blob(chunks, { type: "video/mp4" }),
          url = URL.createObjectURL(blob),
          video = document.createElement("video");
        video.src = url;
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });
        const metadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          bytes: blob.size,
        };
        const base64 = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result.split(",")[1]);
          r.readAsDataURL(blob);
        });
        return { metadata, base64 };
      });
      fs.writeFileSync(file, Buffer.from(result.base64, "base64"));
      await encoder.close();
      return result.metadata;
    },
  };
}
if (process.argv.includes("--probe")) {
  const b = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.goto(SITE);
    await p
      .getByRole("heading", { name: "Welcome to CivicSync.", exact: true })
      .waitFor();
    const capture = await createEncoder(b);
    const start = Date.now();
    while (Date.now() - start < 3200) {
      await capture.frame(
        p,
        "Recording capability test only - not the hackathon demonstration.",
      );
      await delay(65);
    }
    const result = await capture.finish("demo/.work/export-probe.mp4");
    console.log(JSON.stringify(result));
  } finally {
    await b.close();
  }
}
