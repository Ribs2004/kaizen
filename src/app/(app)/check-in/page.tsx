import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckInForm } from "./check-in-form";

export const metadata = { title: "Check in" };

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; date?: string }>;
}) {
  const { error, date } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_streak, last_checkin_date")
    .eq("id", user!.id)
    .maybeSingle();

  // Load today's existing check-in + logs to prefill the form.
  const today = new Date();
  const todayLocal = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const editingDate = date ?? todayLocal;

  const { data: existing } = await supabase
    .from("check_ins")
    .select("id, note")
    .eq("user_id", user!.id)
    .eq("local_date", editingDate)
    .maybeSingle();

  let existingLogs: Array<{
    activity_id: string;
    duration_min: number | null;
    details: Record<string, string | number>;
  }> = [];
  if (existing) {
    const { data: logs } = await supabase
      .from("activity_logs")
      .select("activity_id, duration_min, details")
      .eq("check_in_id", existing.id);
    existingLogs = (logs ?? []) as typeof existingLogs;
  }

  return (
    <CheckInForm
      localDate={editingDate}
      currentStreak={profile?.current_streak ?? 0}
      isEditingToday={profile?.last_checkin_date === editingDate}
      existingNote={existing?.note ?? ""}
      existingLogs={existingLogs}
      serverError={error}
    />
  );
}
