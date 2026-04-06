import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { secret, league_id, predictions_locked } = await req.json();

  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("leagues")
    .update({ predictions_locked })
    .eq("id", league_id);

  if (error) {
    return NextResponse.json({ error: "Error al actualizar liga." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
