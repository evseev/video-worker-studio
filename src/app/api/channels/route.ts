import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/with-auth";
import { createChannelForUser, listChannelsWithProjectCounts } from "@/lib/channels/repository";

const PostBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
});

export const GET = withAuth(async (_request, { user, supabase }) => {
  const { data, error } = await listChannelsWithProjectCounts(supabase, user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ channels: data });
});

export const POST = withAuth(async (request, { user, supabase }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data, error, code } = await createChannelForUser(supabase, user.id, parsed.data.name);
  if (!data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create channel" },
      { status: code === "SLUG_CONFLICT" ? 409 : 500 }
    );
  }

  return NextResponse.json({ channel: data }, { status: 201 });
});
