/**
 * /symptoms layout.
 *
 * Registers the three Symptoms-tab widgets via side-effect import.
 * Node module caching means this runs once even if /log/layout also
 * imports the same module during the same server process.
 */

import "@/lib/symptoms/home-widgets";

export default function SymptomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
