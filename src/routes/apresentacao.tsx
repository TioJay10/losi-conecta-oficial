import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { AppLogo } from "../components/AppLogo";

type PresentationBlock = {
  id: string; parent_id: string | null;
  block_type: "group" | "title" | "paragraph" | "image" | "video" | "card";
  title: string | null; content: string | null; media_url: string | null; media_path: string | null;
  sort_order: number; style: Record<string, unknown>; active: boolean;
};

export const Route = createFileRoute("/apresentacao")({ component: PresentationPage });

function PresentationPage() {
  const [blocks, setBlocks] = useState<PresentationBlock[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data, error } = await supabase.from("presentation_blocks").select("id,parent_id,block_type,title,content,media_url,media_path,sort_order,style,active").eq("active", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      if (!mounted) return;
      if (error) console.error("Erro ao carregar apresentação:", error);
      setBlocks((data ?? []) as PresentationBlock[]);
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, []);
  const roots = useMemo(() => blocks.filter(block => !block.parent_id).sort((a,b) => a.sort_order - b.sort_order), [blocks]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, PresentationBlock[]>();
    for (const block of blocks) {
      if (!block.parent_id) continue;
      const list = map.get(block.parent_id) ?? [];
      list.push(block); map.set(block.parent_id, list);
    }
    for (const list of map.values()) list.sort((a,b) => a.sort_order - b.sort_order);
    return map;
  }, [blocks]);
  function renderBlock(block: PresentationBlock, depth = 0): ReactNode {
    const style = (block.style ?? {}) as CSSProperties;
    const children = childrenByParent.get(block.id) ?? [];
    return <section key={block.id} className={"presentation-group presentation-group-" + block.block_type} data-group-id={block.id} data-group-type={block.block_type} style={style}>
      <div className="presentation-group-inner">
        {block.block_type === "video" && block.media_url && <div className="presentation-media-group"><video className="presentation-video" src={block.media_url} controls playsInline preload="metadata" /></div>}
        {block.block_type === "image" && block.media_url && <div className="presentation-media-group"><img className="presentation-image" src={block.media_url} alt={block.title || "Imagem da apresentação"} /></div>}
        {(block.block_type === "group" || block.block_type === "card") && <div className="presentation-card-group">{block.title && <h2 className="presentation-title-group">{block.title}</h2>}{block.content && <p className="presentation-paragraph-group">{block.content}</p>}</div>}
        {block.block_type === "title" && block.title && <h2 className="presentation-title-group">{block.title}</h2>}
        {block.block_type === "paragraph" && block.content && <p className="presentation-paragraph-group">{block.content}</p>}
        {block.block_type !== "group" && block.block_type !== "card" && block.block_type !== "title" && block.title && <h2 className="presentation-title-group">{block.title}</h2>}
        {block.block_type !== "paragraph" && block.block_type !== "group" && block.block_type !== "card" && block.content && <p className="presentation-paragraph-group">{block.content}</p>}
        {children.length > 0 && <div className="presentation-children">{children.map(child => renderBlock(child, depth + 1))}</div>}
      </div>
    </section>;
  }
  return <main className="presentation-page">
    <header className="presentation-header"><AppLogo aria-label="LOSI CONECTA">LOSI <span>CONECTA</span></AppLogo><a className="presentation-header-link" href="/buscar">Voltar para busca</a></header>
    <div className="presentation-content">
      <section className="presentation-intro-group" data-group-id="presentation-intro"><span className="presentation-eyebrow">LOSI CONECTA</span><h1>Conheça o LOSI CONECTA</h1><p>Uma apresentação da plataforma e da rede de profissionais para eventos.</p></section>
      {loading ? <section className="presentation-empty-group"><span>Carregando apresentação...</span></section> : roots.length === 0 ? <section className="presentation-empty-group"><h2>Apresentação em breve</h2><p>Estamos preparando este espaço para apresentar o LOSI CONECTA.</p></section> : <div className="presentation-groups">{roots.map(block => renderBlock(block))}</div>}
    </div>
  </main>;
}
