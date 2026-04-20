import QuickSymptomGrid from "@/components/symptoms/QuickSymptomGrid";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quick symptom log · LanaeHealth",
};

export default function QuickLogPage() {
  return (
    <main
      className="pb-safe"
      style={{ background: "var(--bg-primary)", minHeight: "100vh" }}
    >
      <QuickSymptomGrid />
    </main>
  );
}
