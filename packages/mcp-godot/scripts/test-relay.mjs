import { sharedWsRelay, parseProjectIdFromUrl } from "../dist/ws-server.js";
import WebSocket from "ws";

const projectId = "test-project-123";

sharedWsRelay.start();
await new Promise((r) => setTimeout(r, 300));

const url = `ws://127.0.0.1:${sharedWsRelay.port}/ws/${projectId}`;
const ws = new WebSocket(url);

await new Promise((resolve, reject) => {
  ws.on("open", resolve);
  ws.on("error", reject);
  setTimeout(() => reject(new Error("timeout")), 3000);
});

console.log("connected:", sharedWsRelay.isConnected(projectId));
console.log("parse:", parseProjectIdFromUrl(`/ws/${projectId}`));

ws.close();
sharedWsRelay.stop();
console.log("relay test ok");
