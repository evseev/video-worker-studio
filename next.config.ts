import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-darwin-x64",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "@remotion/compositor-linux-arm64-gnu",
    "@remotion/compositor-linux-arm64-musl",
    "@remotion/compositor-win32-x64-msvc",
    "esbuild",
  ],
};

const org = process.env.SENTRY_ORG;
const project = process.env.SENTRY_PROJECT;
const authToken = process.env.SENTRY_AUTH_TOKEN;

const shouldEnableSentryBuild = Boolean(org && project);

export default shouldEnableSentryBuild
  ? withSentryConfig(nextConfig, {
      org: org as string,
      project: project as string,
      authToken,

      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",

      silent: !process.env.CI,
    })
  : nextConfig;
