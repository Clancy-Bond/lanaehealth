import { createServiceClient } from "@/lib/supabase";
import { buildPreVisitReport } from "@/lib/reports/pre-visit";
import PreVisitPrepSheet from "@/components/doctor/PreVisitPrepSheet";
import { notFound } from "next/navigation";

// Always fetch fresh data; this powers the moment before a visit.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ appointmentId: string }>;
}

export default async function PreVisitPage({ params }: PageProps) {
  const { appointmentId } = await params;
  const sb = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const report = await buildPreVisitReport(sb, appointmentId, today);
  if (!report) notFound();
  return <PreVisitPrepSheet report={report} today={today} />;
}
