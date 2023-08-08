import { type NextApiRequest } from "next";
import { type Visitor } from "@prisma/client";
import UAParser from "ua-parser-js";
import requestIp from "request-ip";
import { env } from "fpp/env.mjs";
import fetch from "node-fetch";
import { log } from "fpp/utils/console-log";

export async function prepareSessionData(
  req: NextApiRequest
): Promise<Partial<Visitor>> {
  const ua = UAParser(req.headers["user-agent"]);

  let ip = requestIp.getClientIp(req);
  if (!ip || ip === "::1") {
    ip = req.connection.remoteAddress ?? null;
  }

  let geo: { country: string; region: string; city: string } | null = null;
  if (ip && ua.os && env.NEXT_PUBLIC_NODE_ENV !== "development") {
    const url = `'https://ipapi.co/${ip}/json/'`;

    try {
      const resp = await fetch(url);

      const apiData = (await resp.json()) as {
        city: string;
        country_code_iso3: string;
        region: string;
      };

      geo = {
        country: apiData.country_code_iso3,
        region: apiData.region,
        city: apiData.city,
      };

      log("ip address fetch", apiData);
    } catch (e) {
      // TODO: sentry
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      console.error(`Error: ${e.message}`);
    }
  }

  return {
    device: ua.device.type ?? "desktop",
    os: ua.os.name ?? null,
    browser: ua.browser.name ?? null,
    country: geo?.country ?? null,
    region: geo?.region ?? null,
    city: geo?.city ?? null,
  };
}
