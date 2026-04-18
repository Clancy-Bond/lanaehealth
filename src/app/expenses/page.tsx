import { createServiceClient } from "@/lib/supabase";
import ExpensesClient from "@/components/expenses/ExpensesClient";
import type { MedicalExpense } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const supabase = createServiceClient();
  const currentYear = new Date().getFullYear();

  // Load current year + last year so navigation is snappy
  const { data, error } = await supabase
    .from("medical_expenses")
    .select("*")
    .in("plan_year", [currentYear, currentYear - 1])
    .order("service_date", { ascending: false });

  if (error) {
    // Table may not yet exist in this env (migration 026 not run).
    // Render an empty client so the page is still usable.
    return (
      <ExpensesClient initialExpenses={[]} defaultPlanYear={currentYear} />
    );
  }

  return (
    <ExpensesClient
      initialExpenses={(data ?? []) as MedicalExpense[]}
      defaultPlanYear={currentYear}
    />
  );
}
