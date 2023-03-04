import * as Ably from "ably/promises";
import { getClientId } from "~/store/local-storage";

const client = new Ably.Realtime.Promise({
  authUrl: `${
    process.env.NEXT_PUBLIC_API_ROOT || "http://localhost:3000/"
  }api/ably-token`,
  clientId: getClientId(),
});

export const ablyRealtimePromiseExample = async (room: string) => {
  const channel = client.channels.get(room);

  // Attaching to a channel
  await channel.attach();

  // Getting presence on a channel
  const presenceMessage = await channel.presence.get();
  console.log(presenceMessage);

  // Updating presence on a client
  await channel.presence.enter();
  await channel.presence.update("new status");
  await channel.presence.leave();

  // Publishing a message
  await channel.publish("greeting", "Hello, World!");

  // Querying history
  const history = await channel.history({ limit: 25 });
  console.log(history);

  client.close();
};
