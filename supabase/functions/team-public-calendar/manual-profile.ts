const columns = "id,losi_id,full_name,professional_name,whatsapp,city,state,photo_url,calendar_token";

// Só é chamado depois de validar o token pessoal de um colaborador da rede.
export async function resolveManualProfile(client: any, collaborator: any) {
  let profile: any = null;
  if (collaborator.profile_id) {
    const result = await client.from("collaborator_profiles").select(columns).eq("id", collaborator.profile_id).maybeSingle();
    if (result.error) throw result.error;
    profile = result.data;
  } else {
    let normalized = String(collaborator.whatsapp || "").replace(/\D/g, "");
    if (normalized.length === 10 || normalized.length === 11) normalized = "55" + normalized;
    if (normalized.length < 12 || normalized.length > 13) throw new Error("O fornecedor precisa corrigir o WhatsApp deste colaborador para ativar seu calendário.");
    for (let attempt = 0; attempt < 5 && !profile; attempt++) {
      const existing = await client.from("collaborator_profiles").select(columns).eq("whatsapp_normalized", normalized).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) { profile = existing.data; break; }
      const bytes = new Uint32Array(1); crypto.getRandomValues(bytes);
      const created = await client.from("collaborator_profiles").insert({
        losi_id: "LOSI-" + String(bytes[0] % 1000000).padStart(6, "0"),
        full_name: collaborator.name, whatsapp: collaborator.whatsapp,
        whatsapp_normalized: normalized, city: collaborator.city, state: collaborator.state,
      }).select(columns).single();
      if (!created.error) profile = created.data;
      else if (created.error.code !== "23505") throw created.error;
    }
    if (!profile) throw new Error("Não foi possível ativar seu ID LOSI. Tente novamente.");
    const linked = await client.from("team_collaborators").update({ profile_id: profile.id }).eq("id", collaborator.id).is("profile_id", null);
    if (linked.error) throw linked.error;
  }
  return profile;
}
