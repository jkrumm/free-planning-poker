import { type AxiomRequest, Logger } from "next-axiom";
import { type NextRequest, NextResponse, userAgent } from "next/server";
import { type RequestReport } from "next-axiom/src/logger";
import {
  type BaseError,
  removeNulls,
  type ServerLog,
} from "fpp/constants/error.constant";
import * as Sentry from "@sentry/nextjs";

type NextHandler = (
  req: AxiomRequest
) => Promise<Response> | Promise<NextResponse> | NextResponse | Response;

export function withLogger(handler: NextHandler) {
  return async (req: Request | NextRequest) => {
    // res.headers.set("Cache-Control", "s-maxage=1, stale-while-revalidate");
    const startTime = Date.now();

    let geoObj: {
      country: string | undefined;
      region: string;
      city: string | undefined;
    } = {
      country: undefined,
      region: "",
      city: undefined,
    };
    if ("geo" in req) {
      geoObj = {
        country: req.geo?.country,
        region: req.geo?.region ?? "",
        city: req.geo?.city,
      };
    }

    let ip;
    if ("ip" in req) {
      ip = req.ip;
      if (ip === undefined || ip === "::1") {
        ip = req.headers.get("x-forwarded-for");
      }
    }

    const report: RequestReport = {
      startTime,
      path: req.url,
      method: req.method,
      host: req.headers.get("host"),
      userAgent: req.headers.get("user-agent"),
      scheme: "https",
      ip: ip ?? req.headers.get("x-forwarded-for"),
      region: geoObj.region,
    };
    const ua = userAgent(req);
    const reportExtension = removeNulls({
      country: geoObj.country,
      city: geoObj.city,
      browser: ua?.browser?.name,
      device: ua?.device?.type ?? "desktop",
      os: ua?.os?.name,
    });
    const isEdgeRuntime = !!globalThis.EdgeRuntime;

    const logger = new Logger({
      req: { ...report, ...reportExtension },
      source: isEdgeRuntime ? "edge" : "lambda",
    });
    const axiomContext = req as AxiomRequest;
    axiomContext.log = logger;

    try {
      logger.debug("Called Next route handler", {
        ...report,
        ...reportExtension,
        startTime,
      });

      const res = await handler(axiomContext);

      const endTime = Date.now();
      logger.debug("Success Next route handler", {
        ...report,
        ...reportExtension,
        startTime,
        endTime,
        duration: endTime - startTime,
        httpCode: res.status ?? 200,
      });

      logger.attachResponseStatus(200);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await logger.flush();
      if (isEdgeRuntime) {
        logEdgeReport(report);
      }
      if (res instanceof NextResponse) {
        return res;
      }
      return NextResponse.json({}, { status: 200 });
    } catch (error) {
      const endTime = Date.now();

      const e = error as BaseError;

      let errorLogPayload = {
        ...report,
        ...reportExtension,
        ...e?.meta,
        startTime,
        endTime,
        duration: endTime - startTime,
        httpCode: e?.httpCode ?? 500,
        visitorId: logger.config.args?.visitorId
          ? String(logger.config.args?.visitorId)
          : null,
        error: {
          name: e?.name,
          stack: e?.stack,
          message: e?.message,
        },
      } as ServerLog;
      errorLogPayload = removeNulls(errorLogPayload);

      Sentry.captureException(error, {
        tags: {
          endpoint: report.path,
          exception: e.constructor.name,
          httpCode: e.httpCode ?? 500,
        },
        extra: {
          ...errorLogPayload,
        },
      });

      switch (e.constructor.name) {
        case "BadRequestError":
        case "NotFoundError":
        case "NotImplementedError":
        case "TooManyRequestsError":
          logger.warn("Warn in Next route handler", errorLogPayload);
          break;
        case "InternalServerError":
        case "Error":
        default:
          logger.error("Error in Next route handler", errorLogPayload);
          break;
      }

      logger.attachResponseStatus(e.httpCode ?? 500);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await logger.flush();
      if (isEdgeRuntime) {
        logEdgeReport(report);
      }

      if (e.message && e.httpCode) {
        return NextResponse.json({ error: e.message }, { status: e.httpCode });
      }
      return NextResponse.json(
        { error: "InternalServerError" },
        { status: 500 }
      );
    }
  };
}

function logEdgeReport(report: object) {
  console.log(`AXIOM_EDGE_REPORT::${JSON.stringify(report)}`);
}
