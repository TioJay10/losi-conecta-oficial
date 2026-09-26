import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "../lib/supabase";

type FeedProfile = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  slug: string;
  main_category: string | null;
};

type FeedPost = {
  id: string;
  author_user_id: string;
  business_id: string;
  content: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  original_post_id: string | null;
  created_at: string;
  business_name: string;
  slug: string;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  main_category: string | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  send_count: number;
  ranking_score: number;
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

function FeedActionIcon({ type }: { type: "like" | "comment" | "share" | "send" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (type === "like") {
    return <svg {...common}><path d="M20.8 8.8c0 5.1-8.8 10.1-8.8 10.1S3.2 13.9 3.2 8.8A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.8 2.7Z" /></svg>;
  }

  if (type === "comment") {
    return <svg {...common}><path d="M20 11.5a7.5 7.5 0 0 1-7.9 7.5 8.6 8.6 0 0 1-3.4-.7L4 20l1.7-3.9A7.2 7.2 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z" /></svg>;
  }

  if (type === "share") {
    return <svg {...common}><path d="m17 3 4 4-4 4" /><path d="M21 7H10a6 6 0 0 0-6 6v1" /><path d="M7 18h4" /></svg>;
  }

  return <svg {...common}><path d="m21 3-8.5 18-3.2-7.3L2 10.5 21 3Z" /><path d="m9.3 13.7 4.6-4.6" /></svg>;
}

function buildFeedSequence(posts: FeedPost[]) {
  if (posts.length <= 1) return posts;

  const now = Date.now();
  const ageHours = (post: FeedPost) => Math.max(0, (now - new Date(post.created_at).getTime()) / 3_600_000);
  const engagement = (post: FeedPost) =>
    post.like_count +
    post.comment_count * 3 +
    post.repost_count * 4 +
    post.send_count * 5;

  // A primeira passagem privilegia novidade. O ranking do banco continua
  // participando, mas uma publicação recém-criada recebe um impulso forte.
  const freshnessBoost = (post: FeedPost) => {
    const age = ageHours(post);
    if (age <= 1) return 12;
    if (age <= 6) return 8;
    if (age <= 24) return 5;
    if (age <= 72) return 2;
    return 0;
  };

  const initial = [...posts].sort((a, b) => {
    const scoreA = freshnessBoost(a) + Number(a.ranking_score || 0);
    const scoreB = freshnessBoost(b) + Number(b.ranking_score || 0);
    return scoreB - scoreA || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // A publicação continua aparecendo na primeira passagem apenas uma vez.
  // Depois dela, o engajamento determina quantas oportunidades extras ela
  // recebe durante a rolagem. Assim, engajamento aumenta frequência, não
  // posição fixa no topo.
  const extras = new Map<string, number>();
  for (const post of initial) {
    const score = engagement(post);
    const extraCount = score >= 60 ? 3 : score >= 20 ? 2 : score >= 5 ? 1 : 0;
    if (extraCount > 0) extras.set(post.id, extraCount);
  }

  const sequence: FeedPost[] = [];
  let cursor = 0;

  for (const post of initial) {
    sequence.push(post);

    // A cada bloco de 4 publicações, insere uma oportunidade de
    // reaparecimento. Só pode reaparecer quem já apareceu antes,
    // evitando que uma publicação seja duplicada antes da primeira exibição.
    if (sequence.length % 4 === 0 && extras.size > 0) {
      const displayedIds = new Set(sequence.map((item) => item.id));
      const candidates = initial
        .filter((candidate) => {
          const remaining = extras.get(candidate.id) ?? 0;
          return remaining > 0 && candidate.id !== post.id && displayedIds.has(candidate.id);
        })
        .sort((a, b) => engagement(b) - engagement(a));

      const candidate = candidates[cursor % Math.max(1, candidates.length)];
      if (candidate) {
        sequence.push(candidate);
        extras.set(candidate.id, (extras.get(candidate.id) ?? 1) - 1);
        if ((extras.get(candidate.id) ?? 0) <= 0) extras.delete(candidate.id);
        cursor += 1;
      }
    }
  }

  // Se ainda houver posts com saldo de reaparecimento, distribui os
  // restantes no final, sempre evitando duas ocorrências consecutivas.
  while (extras.size > 0) {
    const lastId = sequence.at(-1)?.id;
    const candidates = initial
      .filter((candidate) => (extras.get(candidate.id) ?? 0) > 0 && candidate.id !== lastId)
      .sort((a, b) => engagement(b) - engagement(a));

    const candidate = candidates[0];
    if (!candidate) break;
    sequence.push(candidate);
    extras.set(candidate.id, (extras.get(candidate.id) ?? 1) - 1);
    if ((extras.get(candidate.id) ?? 0) <= 0) extras.delete(candidate.id);
  }

  return sequence;
}

function FeedPage() {
  const [profile, setProfile] = useState<FeedProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [postText, setPostText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; url: string; type: "image" | "video" } | null>(null);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [sendPostId, setSendPostId] = useState<string | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, { id: string; content: string; full_name: string | null; logo_url: string | null; created_at: string; user_id: string; parent_comment_id: string | null; like_count: number }[]>>({});
  const [commentLikedIds, setCommentLikedIds] = useState<string[]>([]);
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentError, setCommentError] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  async function loadFeed(currentUserId: string | null) {
    setLoading(true);
    const { data, error } = await supabase
      .from("feed_post_rankings")
      .select("id,author_user_id,business_id,content,media_url,media_type,original_post_id,created_at,business_name,slug,city,state,logo_url,main_category,like_count,comment_count,repost_count,send_count,ranking_score")
      .order("ranking_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Erro ao carregar Feed:", error);
      setStatusMessage("Não foi possível carregar o Feed agora.");
      setPosts([]);
      setLoading(false);
      return;
    }

    const loaded = (data ?? []) as FeedPost[];
    setPosts(loaded);

    if (currentUserId && loaded.length) {
      const { data: likes } = await supabase
        .from("feed_likes")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", loaded.map((post) => post.id));
      setLikedIds((likes ?? []).map((item) => item.post_id));
    } else {
      setLikedIds([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const { data } = await supabase.auth.getSession();
      const currentUserId = data.session?.user.id ?? null;

      if (!mounted) return;
      setUserId(currentUserId);

      if (currentUserId) {
        const { data: business } = await supabase
          .from("business_profiles")
          .select("id,business_name,city,state,logo_url,slug,active,approval_status")
          .eq("owner_id", currentUserId)
          .maybeSingle();

        if (business?.id && business.active && business.approval_status === "approved") {
          const { data: service } = await supabase
            .from("services")
            .select("categories(name)")
            .eq("business_id", business.id)
            .eq("active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (mounted) {
            setProfile({
              ...business,
              main_category: service?.categories?.name ?? null,
            } as FeedProfile);
          }
        }
      }

      await loadFeed(currentUserId);
      if (mounted) setAuthChecked(true);
    }

    void initialize();
    return () => {
      mounted = false;
      if (selectedMedia?.url) URL.revokeObjectURL(selectedMedia.url);
    };
  }, []);

  function handleMediaChange(event: ChangeEvent<HTMLInputElement>, type: "image" | "video") {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxBytes = type === "video" ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      setStatusMessage(type === "video" ? "O vídeo deve ter no máximo 50 MB." : "A imagem deve ter no máximo 15 MB.");
      event.target.value = "";
      return;
    }

    if (selectedMedia?.url) URL.revokeObjectURL(selectedMedia.url);
    setSelectedMedia({ file, type, url: URL.createObjectURL(file) });
    setMediaMenuOpen(false);
    setStatusMessage("");
    event.target.value = "";
  }

  async function publishPost() {
    if (publishing) return;
    const text = postText.trim();
    if (!text && !selectedMedia) return;

    setPublishing(true);
    setStatusMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id;
      if (!currentUserId) {
        setStatusMessage("Entre na sua conta para publicar.");
        return;
      }

      const { data: currentBusiness, error: businessError } = await supabase
        .from("business_profiles")
        .select("id,business_name,active,approval_status")
        .eq("owner_id", currentUserId)
        .eq("active", true)
        .eq("approval_status", "approved")
        .maybeSingle();

      if (businessError) throw businessError;
      if (!currentBusiness?.id) {
        setStatusMessage("Seu perfil de fornecedor ainda não está aprovado para publicar.");
        return;
      }

      let mediaUrl: string | null = null;
      let mediaType: "image" | "video" | null = selectedMedia?.type ?? null;

      if (selectedMedia) {
        const extension = selectedMedia.file.name.split(".").pop()?.toLowerCase() || (selectedMedia.type === "video" ? "mp4" : "jpg");
        const path = currentUserId + "/" + selectedMedia.type + "-" + crypto.randomUUID() + "." + extension;
        const { error: uploadError } = await supabase.storage.from("feed-media").upload(path, selectedMedia.file, {
          contentType: selectedMedia.file.type || undefined,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        mediaUrl = supabase.storage.from("feed-media").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.rpc("create_feed_post", {
        p_business_id: currentBusiness.id,
        p_content: text || null,
        p_media_url: mediaUrl,
        p_media_type: mediaType,
        p_original_post_id: null,
      });

      if (error) throw error;

      if (selectedMedia?.url) URL.revokeObjectURL(selectedMedia.url);
      setSelectedMedia(null);
      setPostText("");
      await loadFeed(currentUserId);
      setStatusMessage("Publicação realizada com sucesso.");
    } catch (error) {
      console.error("Erro ao publicar no Feed:", error);
      setStatusMessage("Não foi possível publicar agora.");
    } finally {
      setPublishing(false);
    }
  }

  async function toggleLike(post: FeedPost) {
    if (!userId || actionBusy) {
      if (!userId) setStatusMessage("Entre na sua conta para curtir e participar do ranking.");
      return;
    }

    setActionBusy("like-" + post.id);
    const alreadyLiked = likedIds.includes(post.id);

    try {
      if (alreadyLiked) {
        const { error } = await supabase.from("feed_likes").delete().eq("post_id", post.id).eq("user_id", userId);
        if (error) throw error;
        setLikedIds((current) => current.filter((id) => id !== post.id));
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, like_count: Math.max(0, item.like_count - 1) } : item));
      } else {
        const { error } = await supabase.from("feed_likes").insert({ post_id: post.id, user_id: userId });
        if (error) throw error;
        setLikedIds((current) => [...current, post.id]);
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, like_count: item.like_count + 1 } : item));
      }
    } catch (error) {
      console.error("Erro ao curtir publicação:", error);
    } finally {
      setActionBusy(null);
    }
  }

  async function loadComments(postId: string) {
    setCommentLoading(true);
    setCommentError((current) => ({ ...current, [postId]: "" }));

    try {
      // feed_comments não possui FK para profiles. Buscamos os comentários
      // primeiro e os nomes dos autores separadamente para não depender
      // de um relacionamento inexistente no Supabase.
      const { data, error } = await supabase
        .from("feed_comments")
        .select("id,content,created_at,user_id,parent_comment_id")
        .eq("post_id", postId)
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const commentRows = data ?? [];
      const commentIds = commentRows.map((item) => item.id);
      let commentLikeCounts: Record<string, number> = {};
      if (commentIds.length) {
        const { data: likeRows, error: likeError } = await supabase
          .from("feed_comment_likes")
          .select("comment_id,user_id")
          .in("comment_id", commentIds);
        if (likeError) console.error("Erro ao carregar curtidas dos comentários:", likeError);
        else {
          commentLikeCounts = (likeRows ?? []).reduce<Record<string, number>>((acc, row) => {
            acc[row.comment_id] = (acc[row.comment_id] ?? 0) + 1;
            return acc;
          }, {});
          if (userId) setCommentLikedIds((likeRows ?? []).filter((row) => row.user_id === userId).map((row) => row.comment_id));
        }
      }
      const userIds = [...new Set(commentRows.map((item) => item.user_id).filter(Boolean))];
      let profileNames: Record<string, string | null> = {};
      let profileLogos: Record<string, string | null> = {};

      if (userIds.length) {
        const { data: businessRows, error: businessError } = await supabase
          .from("business_profiles")
          .select("owner_id,business_name,logo_url")
          .in("owner_id", userIds)
          .eq("active", true)
          .eq("approval_status", "approved");

        if (businessError) {
          console.error("Erro ao carregar fornecedores dos comentários:", businessError);
        } else {
          for (const business of businessRows ?? []) {
            profileNames[business.owner_id] = business.business_name ?? null;
            profileLogos[business.owner_id] = business.logo_url ?? null;
          }
        }

        // Fallback para usuários que ainda não possuem perfil de fornecedor.
        const missingUserIds = userIds.filter((id) => !profileNames[id]);
        if (missingUserIds.length) {
          const { data: profileRows, error: profileError } = await supabase
            .from("profiles")
            .select("id,full_name")
            .in("id", missingUserIds);

          if (profileError) {
            console.error("Erro ao carregar nomes dos comentários:", profileError);
          } else {
            for (const profile of profileRows ?? []) {
              profileNames[profile.id] = profile.full_name ?? null;
            }
          }
        }
      }

      setComments((current) => ({
        ...current,
        [postId]: commentRows.map((item) => ({
          id: item.id,
          content: item.content,
          created_at: item.created_at,
          user_id: item.user_id,
          parent_comment_id: item.parent_comment_id ?? null,
          like_count: commentLikeCounts[item.id] ?? 0,
          full_name: profileNames[item.user_id] ?? "Usuário LOSI",
          logo_url: profileLogos[item.user_id] ?? null,
        })),
      }));
    } catch (error) {
      console.error("Erro ao carregar comentários:", error);
      setComments((current) => ({ ...current, [postId]: current[postId] ?? [] }));
      setCommentError((current) => ({ ...current, [postId]: "Não foi possível carregar os comentários agora. Tente novamente." }));
    } finally {
      setCommentLoading(false);
    }
  }

  function toggleComments(postId: string) {
    const opening = commentPostId !== postId;
    setShowAllComments(false);
    setCommentError((current) => ({ ...current, [postId]: "" }));
    setCommentPostId(opening ? postId : null);
    if (opening) void loadComments(postId);
  }

  async function toggleCommentLike(commentId: string) {
    if (!userId) { setStatusMessage("Entre na sua conta para curtir comentários."); return; }
    if (actionBusy) return;
    setActionBusy("comment-like-" + commentId);
    const liked = commentLikedIds.includes(commentId);
    try {
      if (liked) {
        const { error } = await supabase.from("feed_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
        if (error) throw error;
        setCommentLikedIds((current) => current.filter((id) => id !== commentId));
      } else {
        const { error } = await supabase.from("feed_comment_likes").insert({ comment_id: commentId, user_id: userId });
        if (error) throw error;
        setCommentLikedIds((current) => [...current, commentId]);
      }
      if (commentPostId) await loadComments(commentPostId);
    } catch (error) { console.error("Erro ao curtir comentário:", error); }
    finally { setActionBusy(null); }
  }

  async function submitComment(post: FeedPost) {
    if (!userId) {
      setStatusMessage("Entre na sua conta para comentar.");
      return;
    }
    const content = commentDraft.trim();
    if (!content || actionBusy) return;

    setActionBusy("comment-" + post.id);
    try {
      const { error } = await supabase.rpc("create_feed_comment", {
        p_post_id: post.id,
        p_content: content.slice(0, 1000),
        p_parent_comment_id: replyToCommentId,
      });
      if (error) throw error;
      setCommentDraft("");
      setReplyToCommentId(null);
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, comment_count: item.comment_count + 1 } : item));
      await loadComments(post.id);
    } catch (error) {
      console.error("Erro ao comentar:", error);
      setStatusMessage("Não foi possível publicar o comentário.");
    } finally {
      setActionBusy(null);
    }
  }

  async function repostPost(post: FeedPost) {
    if (!userId) {
      setStatusMessage("Entre na sua conta para compartilhar esta publicação.");
      return;
    }
    if (actionBusy) return;

    setActionBusy("repost-" + post.id);
    try {
      let shareProfile = profile;

      if (!shareProfile) {
        const { data: business, error: businessError } = await supabase
          .from("business_profiles")
          .select("id,business_name,city,state,logo_url,slug,active,approval_status")
          .eq("owner_id", userId)
          .eq("active", true)
          .eq("approval_status", "approved")
          .maybeSingle();

        if (businessError) throw businessError;
        if (!business?.id) {
          setStatusMessage("Para compartilhar no seu Feed, é necessário ter um perfil de fornecedor aprovado.");
          return;
        }

        const { data: service } = await supabase
          .from("services")
          .select("categories(name)")
          .eq("business_id", business.id)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        shareProfile = { ...business, main_category: service?.categories?.name ?? null } as FeedProfile;
        setProfile(shareProfile);
      }

      const originalId = post.original_post_id ?? post.id;
      const { error } = await supabase.rpc("create_feed_post", {
        p_business_id: shareProfile.id,
        p_content: post.content,
        p_media_url: post.media_url,
        p_media_type: post.media_type,
        p_original_post_id: originalId,
      });

      if (error) {
        if (error.code === "23505") {
          setStatusMessage("Você já compartilhou esta publicação.");
          return;
        }
        throw error;
      }

      await loadFeed(userId);
      setStatusMessage("Publicação compartilhada no seu Feed.");
    } catch (error) {
      console.error("Erro ao compartilhar publicação:", error);
      setStatusMessage("Não foi possível compartilhar esta publicação.");
    } finally {
      setActionBusy(null);
    }
  }

  async function sendPost(post: FeedPost, channel: "whatsapp" | "copy") {
    const url = window.location.origin + "/feed#feed-post-" + encodeURIComponent(post.id);
    const text = [post.business_name, post.content].filter(Boolean).join(" — ");
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text + " " + url);

    if (channel === "whatsapp") {
      window.open("https://wa.me/?text=" + encodedText, "_blank", "noopener,noreferrer");
    } else {
      await navigator.clipboard?.writeText(url);
    }

    if (userId) {
      const { data: sendData, error } = await supabase.from("feed_sends").upsert(
        { post_id: post.id, user_id: userId, channel },
        { onConflict: "post_id,user_id", ignoreDuplicates: true, select: "post_id" },
      );
      if (error) {
        console.error("Erro ao registrar envio:", error);
      } else if ((sendData ?? []).length > 0) {
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, send_count: item.send_count + 1 } : item));
      }
    }

    setSendPostId(null);
  }

  function openComments(postId: string) {
    setCommentPostId(postId);
    setShowAllComments(true);
    setReplyToCommentId(null);
    setCommentDraft("");
    setCommentError((current) => ({ ...current, [postId]: "" }));
    void loadComments(postId);
  }

  function closeComments() {
    setCommentPostId(null);
    setReplyToCommentId(null);
    setCommentDraft("");
  }

  function formatDate(value: string) {
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    if (diff < 60_000) return "agora";
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + " min";
    if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + " h";
    return date.toLocaleDateString("pt-BR");
  }

  const location = [profile?.city, profile?.state].filter(Boolean).join(" — ");
  const feedSequence = useMemo(() => buildFeedSequence(posts), [posts]);

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
            <p>Publicações de fornecedores, trabalhos, eventos e novidades.</p>
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
                  {profile.main_category && <span className="feed-category">{profile.main_category}</span>}
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
                  <button type="button" onClick={() => { URL.revokeObjectURL(selectedMedia.url); setSelectedMedia(null); }} aria-label="Remover mídia">×</button>
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
                <button type="button" className="feed-publish-button" onClick={() => void publishPost()} disabled={publishing || (!postText.trim() && !selectedMedia)}>
                  {publishing ? "Publicando..." : "Publicar"}
                </button>
              </div>
            </section>
          ) : (
            <section className="feed-login-card">
              <strong>Quer publicar no Feed?</strong>
              <p>Entre na sua conta de fornecedor aprovada para apresentar seu negócio e compartilhar seus trabalhos.</p>
              <Link to="/entrar">Entrar</Link>
            </section>
          )}

          {statusMessage && <div className="feed-status-message" role="status">{statusMessage}</div>}

          <div className="feed-list">
            {loading ? (
              <section className="feed-empty"><h2>Carregando publicações...</h2></section>
            ) : posts.length === 0 ? (
              <section className="feed-empty">
                <div className="feed-empty-icon"><FeedIcon size={28} /></div>
                <h2>Seu feed começa aqui</h2>
                <p>As publicações dos fornecedores aparecerão nesta timeline. Seja o primeiro a publicar.</p>
              </section>
            ) : (
              feedSequence.map((post, index) => {
                const liked = likedIds.includes(post.id);
                const isRepost = Boolean(post.original_post_id);
                return (
                  <article className="feed-post" key={post.id + "-" + index} id={index === 0 ? "feed-post-" + post.id : undefined}>
                    <div className="feed-post-head">
                      <div className="feed-avatar">
                        {post.logo_url ? <img src={post.logo_url} alt="" /> : <span>{post.business_name.slice(0, 1).toUpperCase()}</span>}
                      </div>
                      <div className="feed-post-identity">
                        {isRepost && <small className="feed-repost-label">Compartilhado por {post.business_name}</small>}
                        <strong>{post.business_name}</strong>
                        <span>{[post.city, post.state].filter(Boolean).join(" — ") || "LOSI CONECTA"} · {formatDate(post.created_at)}</span>
                        {post.main_category && <span className="feed-category">{post.main_category}</span>}
                      </div>
                      <Link to="/fornecedor/$slug" params={{ slug: post.slug }} className="feed-profile-link">Ver perfil público</Link>
                    </div>

                    {post.content && <p className="feed-post-text">{post.content}</p>}
                    {post.media_url && post.media_type === "image" && <img className="feed-post-media" src={post.media_url} alt="Imagem da publicação" />}
                    {post.media_url && post.media_type === "video" && <video className="feed-post-media" src={post.media_url} controls />}

                    <div className="feed-post-actions">
                      <div className="feed-action-group">
                        <button type="button" className={liked ? "is-liked" : ""} onClick={() => void toggleLike(post)} disabled={actionBusy === "like-" + post.id}>
                          <span className="feed-action-icon"><FeedActionIcon type="like" /></span>
                          <span className="feed-action-label">Curtir</span>
                        </button>
                        <small>{post.like_count}</small>
                      </div>
                      <div className="feed-action-group">
                        <button
                          type="button"
                          aria-expanded={commentPostId === post.id}
                          aria-controls={"feed-comments-" + post.id}
                          onClick={() => openComments(post.id)}
                        >
                          <span className="feed-action-icon"><FeedActionIcon type="comment" /></span>
                          <span className="feed-action-label">Comentar</span>
                        </button>
                        <small>{post.comment_count}</small>
                      </div>
                      <div className="feed-action-group">
                        <button
                          type="button"
                          aria-label="Compartilhar publicação no meu Feed"
                          onClick={() => void repostPost(post)}
                          disabled={actionBusy === "repost-" + post.id}
                        >
                          <span className="feed-action-icon"><FeedActionIcon type="share" /></span>
                          <span className="feed-action-label">Compartilhar</span>
                        </button>
                        <small>{post.repost_count}</small>
                      </div>
                      <div className="feed-action-group">
                        <button type="button" onClick={() => setSendPostId(sendPostId === post.id ? null : post.id)}>
                          <span className="feed-action-icon"><FeedActionIcon type="send" /></span>
                          <span className="feed-action-label">Enviar</span>
                        </button>
                        <small>{post.send_count}</small>
                      </div>
                    </div>

                    {sendPostId === post.id && (
                      <div className="feed-send-panel" aria-label="Enviar publicação">
                        <button type="button" onClick={() => void sendPost(post, "whatsapp")}>WhatsApp</button>
                        <button type="button" onClick={() => void sendPost(post, "copy")}>Copiar link</button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>

          {commentPostId && (() => {
            const activePost = posts.find((item) => item.id === commentPostId);
            if (!activePost) return null;
            const activeComments = comments[activePost.id] ?? [];
            const replyTarget = activeComments.find((item) => item.id === replyToCommentId);
            return (
              <div className="feed-comments-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeComments(); }}>
                <section className="feed-comments-sheet" role="dialog" aria-modal="true" aria-label="Comentários da publicação">
                  <div className="feed-comments-handle" aria-hidden="true" />
                  <header className="feed-comments-sheet-head">
                    <div><strong>Comentários</strong><span>{activeComments.length} comentário(s)</span></div>
                    <button type="button" className="feed-comments-close" onClick={closeComments} aria-label="Fechar comentários">×</button>
                  </header>
                  <div className="feed-comments-scroll">
                    {commentLoading && <div className="feed-comments-loading">Carregando comentários...</div>}
                    {!commentLoading && commentError[activePost.id] && <div className="feed-comments-loading feed-comment-error">{commentError[activePost.id]}</div>}
                    {!commentLoading && !commentError[activePost.id] && activeComments.length === 0 && <div className="feed-comments-empty">Seja o primeiro a comentar.</div>}
                    {!commentLoading && !commentError[activePost.id] && activeComments.map((comment) => {
                      const liked = commentLikedIds.includes(comment.id);
                      return (
                        <article key={comment.id} className={[comment.parent_comment_id ? "feed-comment-row feed-comment-row-reply" : "feed-comment-row", userId && comment.user_id === userId ? "feed-comment-row-mine" : "", userId && comment.user_id !== userId ? "feed-comment-row-other" : ""].filter(Boolean).join(" ")}>
                          <div className="feed-comment-avatar">
                            {comment.logo_url ? (
                              <img src={comment.logo_url} alt="" />
                            ) : (
                              <span>{(comment.full_name || "U").slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="feed-comment-body">
                            <div className="feed-comment-bubble"><strong>{comment.full_name || "Usuário LOSI"}</strong><p>{comment.content}</p></div>
                            <div className="feed-comment-meta">
                              <span>{formatDate(comment.created_at)}</span>
                              <button type="button" className={liked ? "is-liked" : ""} onClick={() => void toggleCommentLike(comment.id)}>Curtir <b>{comment.like_count}</b></button>
                              <button type="button" onClick={() => { setReplyToCommentId(comment.id); setCommentDraft(""); }}>Responder</button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="feed-comments-composer">
                    {replyTarget && <div className="feed-replying"><span>Respondendo a <strong>{replyTarget.full_name || "Usuário LOSI"}</strong></span><button type="button" onClick={() => setReplyToCommentId(null)} aria-label="Cancelar resposta">×</button></div>}
                    {userId ? (
                      <div className="feed-comment-form feed-comment-form-sheet">
                        <input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitComment(activePost); } }} maxLength={1000} placeholder={replyTarget ? "Escreva uma resposta..." : "Adicione um comentário..."} aria-label={replyTarget ? "Escreva uma resposta" : "Adicione um comentário"} />
                        <button type="button" className="feed-comment-send" onClick={() => void submitComment(activePost)} disabled={!commentDraft.trim() || actionBusy === "comment-" + activePost.id}>{actionBusy === "comment-" + activePost.id ? "..." : "Enviar"}</button>
                      </div>
                    ) : <div className="feed-comment-login">Entre na sua conta para comentar.</div>}
                  </div>
                </section>
              </div>
            );
          })()}

        <aside className="feed-side">
          <section className="feed-side-card">
            <span className="feed-kicker">FEED LOSI</span>
            <h2>Uma vitrine profissional para o seu negócio.</h2>
            <p>O Feed usa as interações reais para definir a relevância das publicações, separado do ranqueamento da Busca.</p>
          </section>
        </aside>
      </section>
    </main>
  );
}
