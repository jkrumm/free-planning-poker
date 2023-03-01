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

export function getUsername(): string | null {
  if (typeof window == "undefined") {
    return null;
  } else {
    return localStorage.getItem("username");
  }
}

export function setUsername(username: string): void {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  } else {
    localStorage.setItem("username", username);
  }
}

export function getLocalstorageRoom(): string | null {
  if (typeof window == "undefined") {
    return null;
  } else {
    return localStorage.getItem("room");
  }
}

export function setLocalstorageRoom(room: string): void {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  } else {
    return localStorage.setItem("room", room);
  }
}
