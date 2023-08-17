import { NextResponse } from "next/server";

export const config = {
  runtime: "edge",
};

export default function handler() {
  return new NextResponse("too many requests", {
    status: 429,
  });
}
