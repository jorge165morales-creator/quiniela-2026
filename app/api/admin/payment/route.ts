import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { secret, player_id, paid } = await req.json();

  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!player_id || typeof paid !== "boolean") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error } = await createServiceClient()
    .from("players")
    .update({ paid })
    .eq("id", player_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
