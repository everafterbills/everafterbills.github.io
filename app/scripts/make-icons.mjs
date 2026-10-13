import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { iconSvg, splashSvg, markSvg } from "./logo.mjs";

const out = new URL("../public/icons/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const png = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out + file);

await png(iconSvg(1024), "icon-1024.png");
await png(iconSvg(512), "icon-512.png");
await png(iconSvg(192), "icon-192.png");
await png(iconSvg(180), "apple-touch-icon.png");
await png(iconSvg(512, { maskable: true }), "icon-maskable-512.png");
await png(iconSvg(64), "favicon-64.png");

// Standalone mark (transparent) for the UI
writeFileSync(out + "mark.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${markSvg({ id: "f" })}</svg>`);
writeFileSync(out + "favicon.svg", iconSvg(64));

// iOS launch screens (portrait) for current iPhones
const splashes = [
  [1179, 2556, 393, 852, 3], [1290, 2796, 430, 932, 3], [1206, 2622, 402, 874, 3],
  [1320, 2868, 440, 956, 3], [1170, 2532, 390, 844, 3], [1284, 2778, 428, 926, 3], [1125, 2436, 375, 812, 3],
  [750, 1334, 375, 667, 2],
];
const links = [];
for (const [w, h, dw, dh, r] of splashes) {
  const file = `splash-${w}x${h}.png`;
  await png(splashSvg(w, h), file);
  links.push(`<link rel="apple-touch-startup-image" media="(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="/icons/${file}">`);
}
writeFileSync(new URL("./splash-links.html", import.meta.url).pathname, links.join("\n") + "\n");
console.log("icons done");
