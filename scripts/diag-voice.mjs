#!/usr/bin/env node
// Run on VPS: node --experimental-transform-types scripts/diag-voice.mjs
import { execFileSync } from "node:child_process";

const url = "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3";
console.log("Node", process.version);
console.log("ffmpeg-static", await import("ffmpeg-static").then(m=>m.default).catch(e=>String(e)));
try {
  const ffmpeg = (await import("ffmpeg-static")).default;
  console.log("ffmpeg path", ffmpeg);
  const ffProbe = execFileSync(ffmpeg, ["-v","info","-i",url,"-f","s16le","-ar","48000","-ac","2","-t","1","-"], {timeout:15000, encoding:"utf8", stdio:"pipe"});
  console.log("ffmpeg probe out len", ffProbe.length);
} catch (e) {
  console.log("ffmpeg probe err", e.stderr?.toString().slice(0,500) || e.message.slice(0,500), "status", e.status);
}
try {
  const r = await fetch(url, {method:"HEAD", signal: AbortSignal.timeout(8000)});
  console.log("HEAD", r.status, r.ok, Object.fromEntries([...r.headers.entries()].slice(0,5)));
} catch(e){ console.log("HEAD err", e.message); }
try {
  const r2 = await fetch(url, {signal: AbortSignal.timeout(15000)});
  console.log("GET", r2.status, r2.headers.get("content-type"), r2.headers.get("content-length"));
  const b = await r2.arrayBuffer();
  console.log("GET bytes", b.byteLength);
} catch(e){ console.log("GET err", e.message); }

try {
  const {createAudioResource} = await import("@discordjs/voice");
  const res = createAudioResource(url);
  console.log("createAudioResource ok", !!res, res.metadata);
} catch(e){ console.log("createAudioResource err", e.message); }

try {
  const opus = await import("@discordjs/opus");
  console.log("opus ok", !!opus.OpusEncoder);
} catch(e){ console.log("opus err", e.message); }

console.log("done diag");
