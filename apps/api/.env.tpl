# Local development values; there is no secret in this file, so no op:// reference. Load it where a script
# needs it: `bun --env-file=.env.tpl run db:migrate`. Tests start their own cluster and never read DATABASE_URL.
DATABASE_URL=postgres://postgres@127.0.0.1:5432/fpp
# The device hash's key for local development only; production's comes from the vps repo's fpp-api environment.
VISITOR_KEY=local-development-visitor-key-not-a-secret
# POST /api/contact and POST /api/feedback answer 503 until both variables of a route are set, which is the local default.
# Uncomment to see the 502 a form shows when its upstream is down; production's values come from the vps repo's fpp-api
# environment, never from a file of this repository.
# EMAIL_GATEWAY_URL=https://dev-disabled.local
# EMAIL_GATEWAY_SECRET_KEY=local-dev-noop
# FACTORY_FEEDBACK_URL=https://dev-disabled.local/feedback/free-planning-poker
# FACTORY_FEEDBACK_TOKEN=local-dev-noop
