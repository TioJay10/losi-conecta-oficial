type ScaleOpening = { id: string; title: string; slots: number };
type ScaleMember = { opening_id: string; status: string; attendance_status?: string | null };

// The supplier's assigned role is a label; opening_id identifies the occupied vacancy.
export function getTeamScale<O extends ScaleOpening, A extends ScaleMember>(openings: O[], applications: A[]) {
  const members = applications.filter(a => a.status === "confirmed");
  const byOpening = new Map<string, A[]>();
  for (const member of members) {
    const group = byOpening.get(member.opening_id) || [];
    group.push(member);
    byOpening.set(member.opening_id, group);
  }
  const roles = openings.map(opening => {
    const assigned = byOpening.get(opening.id) || [];
    return { ...opening, assigned, filled: assigned.length, remaining: Math.max(0, opening.slots - assigned.length), over: Math.max(0, assigned.length - opening.slots) };
  });
  const slots = openings.reduce((n, opening) => n + opening.slots, 0);
  return { roles, totals: { slots, filled: members.length, remaining: Math.max(0, slots - members.length), confirmed: members.filter(a => a.attendance_status === "confirmed").length, unavailable: members.filter(a => a.attendance_status === "unavailable").length } };
}
