import { sharedWsRelay } from "../dist/ws-server.js";
import WebSocket from "ws";

sharedWsRelay.start();
await new Promise((r) => setTimeout(r, 200));

for (const id of ["project-a", "project-b"]) {
  const ws = new WebSocket(`ws://127.0.0.1:${sharedWsRelay.port}/ws/${id}`);
  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
}

console.log("connected ids:", sharedWsRelay.getConnectedProjectIds());
sharedWsRelay.stop();
console.log("multi-project test ok");
