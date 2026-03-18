import * as Sentry from "@sentry/nextjs";

// Client-side Sentry initialization. If DSN isn't configured, Sentry will
// effectively be disabled (but the exports remain safe).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,

    // 100% in dev, 10% in production
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

    enableLogs: process.env.NODE_ENV === "development",
  });
}

// Hook into App Router navigation transitions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

