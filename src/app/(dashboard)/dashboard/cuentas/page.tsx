import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { obtenerCuentas } from "./actions";
import CuentasClient from "./cuentas-client";

export const metadata = { title: "Cuentas — Óptica" };

export default async function CuentasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "administrador") redirect("/dashboard");

  const cuentas = await obtenerCuentas();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-t-primary">Cuentas</h1>
        <p className="text-t-muted text-sm mt-1">Control de saldo de efectivo y banco</p>
      </div>

      <CuentasClient cuentasIniciales={cuentas} />
    </div>
  );
}
