/**
 * In-app feedback contract shared by the web form and the fpp-server
 * `/feedback` endpoint. Limits sit inside the factory door's own bounds
 * (title 1-500, version 1-64, route 1-256).
 */
export const FEEDBACK_LIMITS = {
  TITLE_MAX: 200,
  TEXT_MAX: 2000,
  VERSION_MAX: 64,
  ROUTE_MAX: 256,
} as const;

export interface FeedbackInput {
  title: string;
  text?: string;
  version: string;
  route: string;
}
