import { type AxiomRequest } from "next-axiom";

export async function decodeBlob<T>(req: AxiomRequest): Promise<T> {
  const buffer = Buffer.from(await req.arrayBuffer());
  const jsonString = buffer.toString();
  return JSON.parse(jsonString) as T;
}
