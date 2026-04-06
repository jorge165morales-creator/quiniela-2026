import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, username, failed_attempts, locked_until")
    .order("name");

  if (error) return NextResponse.json({ error: "Error al obtener usuarios." }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { secret, user_id, new_password } = await req.json();

  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!user_id || !new_password || new_password.length < 6) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const password_hash = await bcrypt.hash(new_password, 10);

  const { error } = await supabase
    .from("users")
    .update({ password_hash, failed_attempts: 0, locked_until: null })
    .eq("id", user_id);

  if (error) return NextResponse.json({ error: "Error al actualizar contraseña." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
