import { createServiceClient } from "@/lib/supabase";
import { PostVisitForm } from "@/components/doctor/PostVisitForm";
import type { Appointment } from "@/lib/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function PostVisitPage({ searchParams }: PageProps) {
  const { id } = await searchParams;

  if (!id) {
    redirect("/");
  }

  const sb = createServiceClient();
  const { data } = await sb
    .from("appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const appt = (data as Appointment | null) ?? null;
  if (!appt) {
    redirect("/");
  }

  return <PostVisitForm appointment={appt} />;
}
