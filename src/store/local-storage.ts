import { v4 } from "uuid";

export function getClientId(): string {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  } else {
    let clientId = localStorage.getItem("userId");
    if (!clientId) {
      clientId = v4();
      localStorage.setItem("userId", clientId);
    }
    return clientId;
  }
}
