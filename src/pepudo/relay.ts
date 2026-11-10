// Message relay for online play. Both players connect out to public MQTT
// brokers over secure WebSockets, so it works behind any NAT or mobile
// network (no direct browser-to-browser link needed). Every message is sent
// through all reachable brokers at once; receivers drop the duplicates. One
// broker in common is enough to play.
import mqtt, { MqttClient } from "mqtt";

const DEFAULT_BROKERS = [
  "wss://mqtt.eclipseprojects.io/mqtt", // port 443, passes strict office firewalls
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];

/** Override with VITE_PEPUDO_BROKERS="wss://a/mqtt,wss://b/mqtt" (e.g. your own broker). */
const brokerUrls = (): string[] => {
  const env = import.meta.env.VITE_PEPUDO_BROKERS as string | undefined;
  const list = env?.split(",").map((s) => s.trim()).filter(Boolean);
  return list?.length ? list : DEFAULT_BROKERS;
};

export interface Relay {
  total: number;
  publish: (topic: string, payload: string) => void;
  close: () => void;
}

export function openRelay(
  topics: string[],
  onMessage: (topic: string, payload: string) => void,
  onLinks: (connected: number) => void,
): Relay {
  const clients: MqttClient[] = brokerUrls().map((url) =>
    mqtt.connect(url, {
      clientId: `pepudo-${Math.random().toString(36).slice(2, 12)}`,
      clean: true,
      keepalive: 20,
      reconnectPeriod: 2500,
      connectTimeout: 8000,
      queueQoSZero: false,
      resubscribe: false,
    }),
  );
  let closed = false;
  const report = () => !closed && onLinks(clients.filter((c) => c.connected).length);

  clients.forEach((c) => {
    c.on("connect", () => {
      c.subscribe(topics, { qos: 0 }, report);
    });
    c.on("close", report);
    c.on("error", () => undefined); // reconnects on its own
    c.on("message", (topic, payload) => !closed && onMessage(topic, payload.toString()));
  });

  // Phones freeze background tabs and their sockets. When the page comes back
  // after a while, don't trust old sockets: reconnect them all.
  let hiddenAt = 0;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > 4000) {
      clients.forEach((c) => c.end(true, () => !closed && c.reconnect()));
    }
  };
  const onOnline = () => clients.forEach((c) => !c.connected && !closed && c.reconnect());
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);

  return {
    total: clients.length,
    publish: (topic, payload) => clients.forEach((c) => c.connected && c.publish(topic, payload, { qos: 0 })),
    close: () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      clients.forEach((c) => c.end(true));
    },
  };
}
