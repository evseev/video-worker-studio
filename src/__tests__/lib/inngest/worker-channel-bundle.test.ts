import { describe, it, expect } from "vitest";
import {
  parseWorkerChannelRpcJson,
  workerBundleToChannelContext,
} from "@/lib/inngest/worker-channel-bundle";

describe("parseWorkerChannelRpcJson", () => {
  it("maps RPC json to bundle with watermark", () => {
    const bundle = parseWorkerChannelRpcJson({
      channel_id: "11111111-1111-4111-8111-111111111111",
      niche: "Tech",
      target_language: "en",
      target_audience: "All",
      tone: "Fun",
      logo_url: "https://x/logo.png",
      watermark_position: "br",
      watermark_opacity: 0.55,
    });
    expect(bundle.channelId).toBe("11111111-1111-4111-8111-111111111111");
    expect(bundle.watermark).toEqual({
      logoUrl: "https://x/logo.png",
      position: "br",
      opacity: 0.55,
    });
    expect(workerBundleToChannelContext(bundle)).toEqual({
      niche: "Tech",
      targetLanguage: "en",
      targetAudience: "All",
      tone: "Fun",
    });
  });

  it("falls back watermark position to none when invalid", () => {
    const bundle = parseWorkerChannelRpcJson({
      channel_id: "11111111-1111-4111-8111-111111111111",
      niche: null,
      target_language: null,
      target_audience: null,
      tone: null,
      logo_url: null,
      watermark_position: "invalid",
      watermark_opacity: 1,
    });
    expect(bundle.watermark.position).toBe("none");
    expect(workerBundleToChannelContext(bundle)).toEqual({});
  });
});
