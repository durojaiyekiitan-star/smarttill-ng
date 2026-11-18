import AllocationForm from "@/components/AllocationForm";
import { Card, PageTitle } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";

export default async function AllocationPage() {
  const sb = await supabaseServer();
  const { data: s } = await sb.from("allocation_settings").select("*").maybeSingle();
  return (
    <>
      <PageTitle title="Allocation" sub="How every new sale is split." />
      <Card className="max-w-xl"><AllocationForm initialReserve={s?.reserve_percent ?? 70} /></Card>
    </>
  );
}
