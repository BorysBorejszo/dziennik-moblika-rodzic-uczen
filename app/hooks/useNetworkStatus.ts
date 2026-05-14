import { useEffect, useState } from "react";

export type NetworkStatus = "online" | "offline" | "unknown";

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>("unknown");

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const NetInfo = require("@react-native-community/netinfo").default;
        const state = await NetInfo.fetch();
        setStatus(state.isConnected ? "online" : "offline");
        unsubscribe = NetInfo.addEventListener((s: { isConnected: boolean | null }) => {
          setStatus(s.isConnected ? "online" : "offline");
        });
      } catch {
        // package not installed — assume online
        setStatus("online");
      }
    };

    void setup();
    return () => { unsubscribe?.(); };
  }, []);

  return status;
}

export default function UseNetworkStatusRoute() { return null; }
