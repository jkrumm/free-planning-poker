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

export function setLocalstorageRoom(room: string | null): void {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  } else if (room === null) {
    localStorage.removeItem("room");
  } else {
    return localStorage.setItem("room", room);
  }
}

export function getLocalstorageRecentRoom(): string | null {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  }
  return localStorage.getItem("recentRoom");
}

export function setLocalstorageRecentRoom(room: string): void {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  }
  return localStorage.setItem("recentRoom", room);
}
