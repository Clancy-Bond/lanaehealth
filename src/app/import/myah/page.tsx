import { MyAHImporter } from "@/components/import/MyAHImporter";

export const metadata = {
  title: "Import from myAH - LanaeHealth",
  description: "Import your medical records from the Adventist Health patient portal",
};

export default function MyAHImportPage() {
  return (
    <div
      className="px-4 pt-6 pb-safe"
      style={{ maxWidth: 540, margin: "0 auto" }}
    >
      <MyAHImporter />
    </div>
  );
}
