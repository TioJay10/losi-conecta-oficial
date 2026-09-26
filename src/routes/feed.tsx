import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "../lib/supabase";

type FeedProfile = {
  business_name: string;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  slug: string;
};

type LocalPost = {
  id: string;
  text: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  createdAt: string;
};

export const Route = createFileRoute("/feed")({
  component: FeedPage,
});

function FeedIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5h14M5 12h10M5 19h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 12.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 0V15l2 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeedPage() {
  const [profile, setProfile] = useState<FeedProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [postText, setPostText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: "image" | "video"; name: string } | null>(null);
  const [localPosts, setLocalPosts] = useState<LocalPost[]>([]);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id ?? null;

      if (!mounted) return;

      if (!userId) {
        setAuthChecked(true);
        return;
      }

      const { data: business } = await supabase
        .from("business_profiles")
        .select("business_name,city,state,logo_url,slug")
        .eq("owner_id", userId)
        .maybeSingle();

      if (mounted) {
        setProfile((business ?? null) as FeedProfile | null);
        setAuthChecked(true);
      }
    }

    void loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  function handleMediaChange(event: ChangeEvent<HTMLInputElement>, type: "image" | "video") {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setSelectedMedia({ url, type, name: file.name });
    setMediaMenuOpen(false);
    event.target.value = "";
  }

  function publishLocalPost() {
    const text = postText.trim();
    if (!text && !selectedMedia) return;

    const post: LocalPost = {
      id: crypto.randomUUID(),
      text,
      mediaUrl: selectedMedia?.url ?? null,
      mediaType: selectedMedia?.type ?? null,
      createdAt: new Date().toISOString(),
    };

    setLocalPosts((current) => [post, ...current]);
    setPostText("");
    setSelectedMedia(null);
  }

  function toggleLike(id: string) {
    setLikedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const location = [profile?.city, profile?.state].filter(Boolean).join(" — ");

  return (
    <main className="feed-page">
      <header className="feed-header">
        <div className="feed-header-inner">
          <Link to="/buscar" className="feed-brand" aria-label="Voltar para o LOSI CONECTA">
            LOSI <span>CONECTA</span>
          </Link>

          <div className="feed-header-title">
            <FeedIcon size={18} />
            <strong>Feed</strong>
          </div>

          <Link to="/buscar" className="feed-header-back">Buscar fornecedores</Link>
        </div>
      </header>

      <section className="feed-layout">
        <div className="feed-main">
          <div className="feed-intro">
            <span className="feed-kicker">LOSI CONECTA</span>
            <h1>Feed profissional</h1>
            <p>Compartilhe experiências, trabalhos e novidades do seu negócio.</p>
          </div>

          {authChecked && profile ? (
            <section className="feed-composer" aria-label="Criar publicação">
              <div className="feed-composer-head">
                <div className="feed-avatar">
                  {profile.logo_url ? <img src={profile.logo_url} alt="" /> : <span>{profile.business_name.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="feed-composer-identity">
                  <strong>{profile.business_name}</strong>
                  <span>{location || "Fornecedor LOSI CONECTA"}</span>
                </div>
              </div>

              <textarea
                value={postText}
                onChange={(event) => setPostText(event.target.value)}
                placeholder="No que você está trabalhando?"
                aria-label="Texto da publicação"
                maxLength={2000}
              />

              {selectedMedia && (
                <div className="feed-media-preview">
                  {selectedMedia.type === "image" ? (
                    <img src={selectedMedia.url} alt="Pré-visualização da imagem" />
                  ) : (
                    <video src={selectedMedia.url} controls aria-label="Pré-visualização do vídeo" />
                  )}
                  <button type="button" onClick={() => setSelectedMedia(null)} aria-label="Remover mídia">×</button>
                </div>
              )}

              <div className="feed-composer-footer">
                <div className="feed-media-actions">
                  <button type="button" onClick={() => setMediaMenuOpen((value) => !value)} className="feed-tool-button">
                    <span aria-hidden="true">＋</span> Adicionar mídia
                  </button>
                  {mediaMenuOpen && (
                    <div className="feed-media-menu">
                      <button type="button" onClick={() => imageInputRef.current?.click()}>Imagem</button>
                      <button type="button" onClick={() => videoInputRef.current?.click()}>Vídeo</button>
                    </div>
                  )}
                  <input ref={imageInputRef} hidden type="file" accept="image/*" onChange={(event) => handleMediaChange(event, "image")} />
                  <input ref={videoInputRef} hidden type="file" accept="video/*" onChange={(event) => handleMediaChange(event, "video")} />
                </div>
                <button type="button" className="feed-publish-button" onClick={publishLocalPost} disabled={!postText.trim() && !selectedMedia}>
                  Publicar
                </button>
              </div>
            </section>
          ) : (
            <section className="feed-login-card">
              <strong>Quer publicar no Feed?</strong>
              <p>Entre na sua conta para apresentar o seu negócio e compartilhar seus trabalhos.</p>
              <Link to="/entrar">Entrar</Link>
            </section>
          )}

          <div className="feed-list">
            {localPosts.length === 0 ? (
              <section className="feed-empty">
                <div className="feed-empty-icon"><FeedIcon size={28} /></div>
                <h2>Seu feed começa aqui</h2>
                <p>As publicações dos fornecedores aparecerão nesta timeline. Publique textos, imagens e vídeos sobre o seu negócio.</p>
              </section>
            ) : (
              localPosts.map((post) => (
                <article className="feed-post" key={post.id}>
                  <div className="feed-post-head">
                    <div className="feed-avatar">
                      {profile?.logo_url ? <img src={profile.logo_url} alt="" /> : <span>{profile?.business_name?.slice(0, 1).toUpperCase() || "L"}</span>}
                    </div>
                    <div className="feed-post-identity">
                      <strong>{profile?.business_name || "Fornecedor LOSI CONECTA"}</strong>
                      <span>{location || "LOSI CONECTA"} · agora</span>
                    </div>
                    {profile?.slug && <Link to="/fornecedor/$slug" params={{ slug: profile.slug }} className="feed-profile-link">Ver perfil público</Link>}
                  </div>

                  {post.text && <p className="feed-post-text">{post.text}</p>}

                  {post.mediaUrl && post.mediaType === "image" && <img className="feed-post-media" src={post.mediaUrl} alt="Imagem da publicação" />}
                  {post.mediaUrl && post.mediaType === "video" && <video className="feed-post-media" src={post.mediaUrl} controls />}

                  <div className="feed-post-actions">
                    <button type="button" className={likedIds.includes(post.id) ? "is-liked" : ""} onClick={() => toggleLike(post.id)}>
                      <span aria-hidden="true">♡</span> Curtir
                    </button>
                    <button type="button"><span aria-hidden="true">◯</span> Comentar</button>
                    {profile?.slug && <Link to="/fornecedor/$slug" params={{ slug: profile.slug }}>Ver perfil público</Link>}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="feed-side">
          <section className="feed-side-card">
            <span className="feed-kicker">FEED LOSI</span>
            <h2>Uma vitrine profissional para o seu negócio.</h2>
            <p>Mostre trabalhos, eventos e novidades e permita que outras pessoas encontrem seu perfil público.</p>
          </section>
        </aside>
      </section>
    </main>
  );
}
