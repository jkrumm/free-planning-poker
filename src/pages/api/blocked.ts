import { NextResponse } from "next/server";

export const runtime = "edge";

export default function handler() {
  return new NextResponse("too many requests", {
    status: 429,
  });
}
