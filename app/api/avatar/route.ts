import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const playerId = formData.get("player_id") as string;

  if (!file || !playerId) {
    return NextResponse.json({ error: "Missing file or player_id" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: player } = await service
    .from("players")
    .select("id")
    .eq("id", playerId)
    .single();

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const { error } = await service.storage
    .from("Avatar")
    .upload(playerId, buffer, { contentType: file.type, upsert: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatar/${playerId}`;
  return NextResponse.json({ url });
}
