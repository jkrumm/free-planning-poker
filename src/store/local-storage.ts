export function getUsername(): string | null {
  if (typeof window == "undefined") {
    return null;
  }
  return localStorage.getItem("username");
}

export function setUsername(username: string): void {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  }
  username = username.slice(0, 15).charAt(0).toUpperCase() + username.slice(1);
  localStorage.setItem("username", username);
}

export function getMyPresence(): {
  username: string;
  voting: number | null;
  spectator: boolean;
} {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  }
  const username = localStorage.getItem("username");
  if (username == null) {
    throw new Error("username is null");
  }
  return {
    username,
    voting: localStorage.getItem("voting")
      ? parseInt(localStorage.getItem("voting")!)
      : null,
    spectator: localStorage.getItem("spectator") === "true",
  };
}

export function setMyPresence({
  username,
  voting,
  spectator,
}: {
  username: string;
  voting: number | null;
  spectator: boolean;
}): void {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  }

  setUsername(username);
  localStorage.setItem("spectator", spectator.toString());

  if (voting === null) {
    localStorage.removeItem("voting");
  } else {
    localStorage.setItem("voting", voting.toString());
  }
}

export function resetVote(): void {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  }
  localStorage.removeItem("voting");
}

export function getLocalstorageRoom(): string | null {
  if (typeof window == "undefined") {
    return null;
  }
  return localStorage.getItem("room");
}

export function setLocalstorageRoom(room: string | null): void {
  if (typeof window == "undefined") {
    throw new Error("not on local");
  }
  if (room === null) {
    return localStorage.removeItem("room");
  }
  return localStorage.setItem("room", room);
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
