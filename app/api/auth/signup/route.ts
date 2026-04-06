import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { name, email, username, password } = await req.json();

  if (!name || !email || !username || !password) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return NextResponse.json({ error: "Correo electrónico inválido." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const cleanUsername = username.trim().toLowerCase();

  // Check username not taken
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("username", cleanUsername)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Ese nombre de usuario ya está en uso." },
      { status: 409 }
    );
  }

  // Check email not taken
  const { data: existingEmail } = await supabase
    .from("users")
    .select("id")
    .eq("email", cleanEmail)
    .single();

  if (existingEmail) {
    return NextResponse.json(
      { error: "Ese correo ya está registrado." },
      { status: 409 }
    );
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data: user, error } = await supabase
    .from("users")
    .insert({ name: name.trim(), email: cleanEmail, username: cleanUsername, password_hash })
    .select("id, name, username")
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "Error al crear cuenta." }, { status: 500 });
  }

  return NextResponse.json({ user_id: user.id, name: user.name, username: user.username });
}
