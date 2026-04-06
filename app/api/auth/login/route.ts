import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const cleanUsername = username.trim().toLowerCase();

  const { data: user } = await supabase
    .from("users")
    .select("id, name, username, password_hash, failed_attempts, locked_until")
    .eq("username", cleanUsername)
    .single();

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  // Check if locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil(
      (new Date(user.locked_until).getTime() - Date.now()) / 60000
    );
    return NextResponse.json(
      { error: `Cuenta bloqueada. Intenta en ${minutesLeft} minuto${minutesLeft !== 1 ? "s" : ""}.` },
      { status: 429 }
    );
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatch) {
    const newAttempts = (user.failed_attempts || 0) + 1;
    const locked = newAttempts >= 5;

    await supabase
      .from("users")
      .update({
        failed_attempts: newAttempts,
        locked_until: locked ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      })
      .eq("id", user.id);

    return NextResponse.json(
      {
        error: locked
          ? "Demasiados intentos. Cuenta bloqueada por 15 minutos."
          : `Contraseña incorrecta. ${5 - newAttempts} intento${5 - newAttempts !== 1 ? "s" : ""} restante${5 - newAttempts !== 1 ? "s" : ""}.`,
      },
      { status: 401 }
    );
  }

  // Reset failed attempts
  await supabase
    .from("users")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("id", user.id);

  // Check if user already has a player in any league (to redirect correctly)
  const { data: player } = await supabase
    .from("players")
    .select("id, league_id, leagues(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    user_id: user.id,
    name: user.name,
    username: user.username,
    player_id: player?.id ?? null,
    league_id: player?.league_id ?? null,
    league_name: (player?.leagues as unknown as { name: string } | null)?.name ?? null,
  });
}
