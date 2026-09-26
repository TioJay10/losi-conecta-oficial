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
  active: boolean;
  original_business_name: string | null;
  original_business_slug: string | null;
  original_business_logo_url: string | null;
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
  mentions: Array<{ business_id: string; business_name: string; slug: string }>;
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


function renderPostContent(
  content: string,
  mentions: Array<{ business_id: string; business_name: string; slug: string }>,
  onMentionClick: () => void,
) {
  if (!mentions.length) return content;

  const mentionTokens = mentions
    .map((mention) => ({ ...mention, token: "@" + mention.business_name }))
    .sort((a, b) => b.token.length - a.token.length);

  const nodes: Array<string | JSX.Element> = [];
  let remaining = content;

  while (remaining) {
    let matchIndex = -1;
    let matched: (typeof mentionTokens)[number] | null = null;

    for (const mention of mentionTokens) {
      const index = remaining.indexOf(mention.token);
      if (index >= 0 && (matchIndex === -1 || index < matchIndex)) {
        matchIndex = index;
        matched = mention;
      }
    }

    if (!matched || matchIndex === -1) {
      nodes.push(remaining);
      break;
    }

    if (matchIndex > 0) nodes.push(remaining.slice(0, matchIndex));

    nodes.push(
      <button
        key={matched.business_id + "-" + matchIndex + "-" + remaining.length}
        type="button"
        className="feed-mention-link"
        onClick={onMentionClick}
      >
        {matched.token}
      </button>,
    );

    remaining = remaining.slice(matchIndex + matched.token.length);
  }

  return nodes;
}

function buildFeedSequence(posts: FeedPost[]) {
  // Cada publicação pode aparecer somente uma vez por ciclo do Feed.
  // O reaparecimento por engajamento acontece em um novo ciclo/atualização
  // do Feed, nunca criando cópias da mesma publicação na sequência atual.
  if (posts.length <= 1) return posts;

  const now = Date.now();
  const ageHours = (post: FeedPost) =>
    Math.max(0, (now - new Date(post.created_at).getTime()) / 3_600_000);

  const freshnessBoost = (post: FeedPost) => {
    const age = ageHours(post);
    if (age <= 1) return 12;
    if (age <= 6) return 8;
    if (age <= 24) return 5;
    if (age <= 72) return 2;
    return 0;
  };

  // ranking_score já incorpora o engajamento da publicação. A recência
  // funciona como um impulso adicional, sem inserir a mesma publicação
  // novamente na lista renderizada.
  return [...posts].sort((a, b) => {
    const scoreA = freshnessBoost(a) + Number(a.ranking_score || 0);
    const scoreB = freshnessBoost(b) + Number(b.ranking_score || 0);
    return (
      scoreB - scoreA ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

function FeedPage() {
  const [profile, setProfile] = useState<FeedProfile | null>(null);
  const [targetBusiness, setTargetBusiness] = useState<FeedProfile | null>(null);
  const [pendingRequests, setPendingRequests] = useState<Array<{ id: string; post_id: string; requester_user_id: string; post: FeedPost | null; requester_name: string }>>([]);
  const [targetFollowed, setTargetFollowed] = useState(false);
  const [targetMode, setTargetMode] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [postText, setPostText] = useState("");
  const [savedSuppliers, setSavedSuppliers] = useState<Array<{ id: string; business_name: string; logo_url: string | null; owner_id: string }>>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<Array<{ id: string; business_name: string; logo_url: string | null; owner_id: string }>>([]);
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const postTextRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; url: string; type: "image" | "video" } | null>(null);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [sendPostId, setSendPostId] = useState<string | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [commentPostData, setCommentPostData] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Record<string, { id: string; content: string; full_name: string | null; logo_url: string | null; created_at: string; user_id: string; parent_comment_id: string | null; like_count: number }[]>>({});
  const [commentLikedIds, setCommentLikedIds] = useState<string[]>([]);
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentError, setCommentError] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [modalPost, setModalPost] = useState<FeedPost | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [postMenuId, setPostMenuId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  async function loadFeed(currentUserId: string | null, filterBusinessId: string | null = null) {
    setLoading(true);
    const { data, error } = await supabase
      .from("feed_post_rankings")
      .select("id,author_user_id,business_id,content,media_url,media_type,original_post_id,created_at,business_name,slug,city,state,logo_url,main_category,like_count,comment_count,repost_count,send_count,ranking_score")
      .eq(filterBusinessId ? "business_id" : "id", filterBusinessId ?? "00000000-0000-0000-0000-000000000000")
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

    let loaded = (data ?? []).map((post) => ({
      ...(post as FeedPost),
      active: true,
      mentions: [],
    }));

    // Publicações ocultas continuam visíveis somente para o próprio autor,
    // permitindo que ele as edite ou torne visíveis novamente.
    if (currentUserId) {
      const { data: hiddenRows, error: hiddenError } = await supabase
        .from("feed_posts")
        .select("id,author_user_id,business_id,content,media_url,media_type,original_post_id,active,created_at,updated_at")
        .eq("author_user_id", currentUserId)
        .eq("active", false)
        .order("created_at", { ascending: false })
        .limit(30);

      if (hiddenError) {
        console.error("Erro ao carregar publicações ocultas:", hiddenError);
      } else if (hiddenRows?.length) {
        const businessIds = [...new Set(hiddenRows.map((row) => row.business_id).filter(Boolean))];
        const { data: hiddenBusinesses } = await supabase
          .from("business_profiles")
          .select("id,business_name,slug,city,state,logo_url,active,approval_status")
          .in("id", businessIds);
        const businessMap = new Map((hiddenBusinesses ?? []).map((business) => [business.id, business]));
        const hiddenPosts = hiddenRows
          .map((row) => {
            const business = businessMap.get(row.business_id);
            if (!business) return null;
            return {
              id: row.id,
              author_user_id: row.author_user_id,
              business_id: row.business_id,
              content: row.content,
              media_url: row.media_url,
              media_type: row.media_type as "image" | "video" | null,
              original_post_id: row.original_post_id,
              active: false,
              original_business_name: null,
              original_business_slug: null,
              original_business_logo_url: null,
              created_at: row.created_at,
              business_name: business.business_name,
              slug: business.slug,
              city: business.city,
              state: business.state,
              logo_url: business.logo_url,
              main_category: null,
              like_count: 0,
              comment_count: 0,
              repost_count: 0,
              send_count: 0,
              ranking_score: 0,
              mentions: [],
            } as FeedPost;
          })
          .filter((post): post is FeedPost => Boolean(post));
        loaded = [...loaded, ...hiddenPosts];
      }
    }

    // Para republicações, o banco mantém original_post_id apontando para a
    // publicação original (e não para a republicação intermediária). Buscamos
    // o fornecedor dessa publicação para exibir "Compartilhado de X por Y".
    const originalIds = [...new Set(
      loaded
        .map((post) => post.original_post_id)
        .filter((id): id is string => Boolean(id)),
    )];

    if (originalIds.length) {
      const { data: originalRows, error: originalError } = await supabase
        .from("feed_posts")
        .select("id,business_id")
        .in("id", originalIds);

      if (originalError) {
        console.error("Erro ao carregar origem das republicações:", originalError);
      } else if (originalRows?.length) {
        const originalBusinessIds = [...new Set(originalRows.map((row) => row.business_id).filter(Boolean))];
        const { data: originalBusinesses, error: originalBusinessError } = await supabase
          .from("business_profiles")
          .select("id,business_name,slug,logo_url")
          .in("id", originalBusinessIds);

        if (originalBusinessError) {
          console.error("Erro ao carregar fornecedores das publicações originais:", originalBusinessError);
        } else {
          const businessData = new Map(
            (originalBusinesses ?? []).map((business) => [
              business.id,
              {
                name: business.business_name,
                slug: business.slug,
                logo_url: business.logo_url,
              },
            ]),
          );
          const originalBusinessByPostId = new Map(
            originalRows.map((row) => [row.id, businessData.get(row.business_id) ?? null]),
          );

          loaded = loaded.map((post) => {
            const originalBusiness = post.original_post_id
              ? originalBusinessByPostId.get(post.original_post_id) ?? null
              : null;
            return {
              ...post,
              original_business_name: originalBusiness?.name ?? null,
              original_business_slug: originalBusiness?.slug ?? null,
              original_business_logo_url: originalBusiness?.logo_url ?? null,
            };
          });
        }
      }
    }

    // Carrega as marcações reais da publicação para transformar somente
    // os fornecedores efetivamente mencionados em links para o perfil público.
    const postIds = loaded.map((post) => post.id);
    if (postIds.length) {
      const { data: mentionRows, error: mentionError } = await supabase
        .from("feed_post_mentions")
        .select("post_id,business_id")
        .in("post_id", postIds);

      if (mentionError) {
        console.error("Erro ao carregar marcações do Feed:", mentionError);
      } else if (mentionRows?.length) {
        const mentionedBusinessIds = [...new Set(mentionRows.map((row) => row.business_id).filter(Boolean))];
        const { data: mentionedBusinesses, error: mentionedBusinessError } = await supabase
          .from("business_profiles")
          .select("id,business_name,slug")
          .in("id", mentionedBusinessIds)
          .eq("active", true)
          .eq("approval_status", "approved");

        if (mentionedBusinessError) {
          console.error("Erro ao carregar fornecedores mencionados:", mentionedBusinessError);
        } else {
          const mentionedBusinessMap = new Map(
            (mentionedBusinesses ?? []).map((business) => [business.id, business]),
          );
          const mentionsByPost = new Map<string, Array<{ business_id: string; business_name: string; slug: string }>>();

          for (const row of mentionRows) {
            const business = mentionedBusinessMap.get(row.business_id);
            if (!business?.business_name || !business.slug) continue;
            const list = mentionsByPost.get(row.post_id) ?? [];
            list.push({ business_id: business.id, business_name: business.business_name, slug: business.slug });
            mentionsByPost.set(row.post_id, list);
          }

          loaded = loaded.map((post) => ({
            ...post,
            mentions: mentionsByPost.get(post.id) ?? [],
          }));
        }
      }
    }

    // Publicações originais não têm fornecedor de origem separado.
    loaded = loaded.map((post) => ({
      ...post,
      original_business_name: post.original_business_name ?? null,
      original_business_slug: post.original_business_slug ?? null,
      original_business_logo_url: post.original_business_logo_url ?? null,
    }));

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
      const params = new URLSearchParams(window.location.search);
      const supplierSlug = params.get("fornecedor");
      let scopedBusinessId: string | null = null;

      if (supplierSlug) {
        const { data: scopedBusiness } = await supabase
          .from("business_profiles")
          .select("id,business_name,city,state,logo_url,slug,active,approval_status")
          .eq("slug", supplierSlug)
          .eq("active", true)
          .eq("approval_status", "approved")
          .maybeSingle();
        if (scopedBusiness?.id) {
          scopedBusinessId = scopedBusiness.id;
          if (mounted) {
            setTargetMode(true);
            setTargetBusiness(scopedBusiness as FeedProfile);
          }
          if (currentUserId) {
            const { data: followRow } = await supabase
              .from("favorites")
              .select("business_id")
              .eq("user_id", currentUserId)
              .eq("business_id", scopedBusiness.id)
              .maybeSingle();
            if (mounted) setTargetFollowed(Boolean(followRow));
          }
        }
      }

      if (!mounted) return;
      setUserId(currentUserId);

      if (currentUserId) {
        void loadSavedSuppliers(currentUserId);

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

      await loadFeed(currentUserId, scopedBusinessId);
      if (scopedBusinessId && currentUserId) {
        const { data: ownedTarget } = await supabase
          .from("business_profiles")
          .select("id")
          .eq("id", scopedBusinessId)
          .eq("owner_id", currentUserId)
          .maybeSingle();
        if (ownedTarget?.id) {
          const { data: requests } = await supabase
            .from("supplier_feed_publication_requests")
            .select("id,post_id,requester_user_id,created_at")
            .eq("target_business_id", scopedBusinessId)
            .eq("status", "pending")
            .order("created_at", { ascending: false });
          if (requests?.length) {
            const postIds = requests.map((r) => r.post_id);
            const requesterIds = requests.map((r) => r.requester_user_id);
            const [{ data: requestPosts }, { data: requesterProfiles }] = await Promise.all([
              supabase.from("feed_posts").select("id,author_user_id,business_id,content,media_url,media_type,original_post_id,active,created_at").in("id", postIds),
              supabase.from("business_profiles").select("owner_id,business_name").in("owner_id", requesterIds),
            ]);
            const requesterMap = new Map((requesterProfiles ?? []).map((p) => [p.owner_id, p.business_name]));
            const postMap = new Map((requestPosts ?? []).map((p) => [p.id, p as unknown as FeedPost]));
            if (mounted) setPendingRequests(requests.map((r) => ({ ...r, post: postMap.get(r.post_id) ?? null, requester_name: requesterMap.get(r.requester_user_id) ?? "Fornecedor" })));
          } else if (mounted) setPendingRequests([]);
        }
      }
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

  async function loadSavedSuppliers(currentUserId: string) {
    const { data: favoriteRows, error: favoriteError } = await supabase
      .from("favorites")
      .select("business_id")
      .eq("user_id", currentUserId);

    if (favoriteError) {
      console.error("Erro ao carregar fornecedores salvos para marcação:", favoriteError);
      setSavedSuppliers([]);
      return;
    }

    const ids = (favoriteRows ?? []).map((row) => row.business_id).filter(Boolean);
    if (!ids.length) {
      setSavedSuppliers([]);
      return;
    }

    const { data: businesses, error: businessError } = await supabase
      .from("business_profiles")
      .select("id,business_name,logo_url,owner_id")
      .in("id", ids)
      .eq("active", true)
      .eq("approval_status", "approved")
      .order("business_name", { ascending: true });

    if (businessError) {
      console.error("Erro ao carregar fornecedores salvos:", businessError);
      setSavedSuppliers([]);
      return;
    }

    setSavedSuppliers((businesses ?? []) as Array<{ id: string; business_name: string; logo_url: string | null; owner_id: string }>);
  }

  function handlePostTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setPostText(value);

    const caret = event.target.selectionStart ?? value.length;
    const beforeCaret = value.slice(0, caret);
    const match = beforeCaret.match(/(^|\s)@([^@\n]*)$/u);

    if (!match) {
      setMentionSuggestions([]);
      setMentionStart(null);
      return;
    }

    const start = caret - match[2].length - 1;
    const query = match[2].trim().toLocaleLowerCase("pt-BR");
    const suggestions = savedSuppliers
      .filter((supplier) => supplier.business_name.toLocaleLowerCase("pt-BR").includes(query))
      .slice(0, 8);

    setMentionStart(start);
    setMentionSuggestions(suggestions);
  }

  function selectMention(supplier: { id: string; business_name: string; logo_url: string | null; owner_id: string }) {
    const textarea = postTextRef.current;
    if (!textarea || mentionStart === null) return;

    const caret = textarea.selectionStart ?? postText.length;
    const prefix = postText.slice(0, mentionStart);
    const suffix = postText.slice(caret);
    const inserted = "@" + supplier.business_name + " ";
    const nextText = prefix + inserted + suffix;

    setPostText(nextText);
    setMentionIds((current) => current.includes(supplier.id) ? current : [...current, supplier.id]);
    setMentionSuggestions([]);
    setMentionStart(null);

    requestAnimationFrame(() => {
      const nextCaret = prefix.length + inserted.length;
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
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

      const activeMentionIds = mentionIds.filter((businessId) => {
        const supplier = savedSuppliers.find((item) => item.id === businessId);
        return supplier && text.includes("@" + supplier.business_name);
      });

      const rpcName = targetMode && targetBusiness ? "create_supplier_feed_publication" : "create_feed_post";
      const rpcArgs = targetMode && targetBusiness
        ? {
            p_target_business_id: targetBusiness.id,
            p_content: text || null,
            p_media_url: mediaUrl,
            p_media_type: mediaType,
            p_mentioned_business_ids: activeMentionIds.length ? activeMentionIds : null,
          }
        : {
            p_business_id: currentBusiness.id,
            p_content: text || null,
            p_media_url: mediaUrl,
            p_media_type: mediaType,
            p_original_post_id: null,
            p_mentioned_business_ids: activeMentionIds.length ? activeMentionIds : null,
          };
      const { error } = await supabase.rpc(rpcName, rpcArgs);

      if (error) throw error;

      if (selectedMedia?.url) URL.revokeObjectURL(selectedMedia.url);
      setSelectedMedia(null);
      setPostText("");
      setMentionIds([]);
      setMentionSuggestions([]);
      setMentionStart(null);
      await loadFeed(currentUserId, targetBusiness?.id ?? null);
      setStatusMessage(targetMode ? "Publicação enviada para aprovação do fornecedor." : "Publicação realizada com sucesso.");
    } catch (error) {
      console.error("Erro ao publicar no Feed:", error);
      setStatusMessage("Não foi possível publicar agora.");
    } finally {
      setPublishing(false);
    }
  }

  function startEditPost(post: FeedPost) {
    setPostMenuId(null);
    setEditingPostId(post.id);
    setEditingPostText(post.content ?? "");
  }

  function cancelEditPost() {
    setEditingPostId(null);
    setEditingPostText("");
  }

  async function saveEditPost(post: FeedPost) {
    if (!userId || post.author_user_id !== userId || actionBusy) return;
    const content = editingPostText.trim();
    if (!content && !post.media_url) {
      setStatusMessage("A publicação precisa ter texto ou mídia.");
      return;
    }

    setActionBusy("edit-" + post.id);
    try {
      const { data, error } = await supabase
        .from("feed_posts")
        .update({ content: content || null, updated_at: new Date().toISOString() })
        .eq("id", post.id)
        .eq("author_user_id", userId)
        .select("id,content,updated_at")
        .single();
      if (error) throw error;

      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, content: data.content } : item));
      setModalPost((current) => current?.id === post.id ? { ...current, content: data.content } : current);
      cancelEditPost();
      setStatusMessage("Conteúdo atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao editar publicação:", error);
      setStatusMessage("Não foi possível editar esta publicação.");
    } finally {
      setActionBusy(null);
    }
  }

  async function togglePostVisibility(post: FeedPost) {
    if (!userId || post.author_user_id !== userId || actionBusy) return;
    const nextActive = !post.active;
    setActionBusy("visibility-" + post.id);
    try {
      const { error } = await supabase
        .from("feed_posts")
        .update({ active: nextActive, updated_at: new Date().toISOString() })
        .eq("id", post.id)
        .eq("author_user_id", userId);
      if (error) throw error;

      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, active: nextActive } : item));
      setModalPost((current) => current?.id === post.id ? { ...current, active: nextActive } : current);
      setPostMenuId(null);
      setStatusMessage(nextActive ? "Conteúdo novamente visível no Feed." : "Conteúdo ocultado para os demais usuários.");
    } catch (error) {
      console.error("Erro ao alterar visibilidade da publicação:", error);
      setStatusMessage("Não foi possível alterar a visibilidade.");
    } finally {
      setActionBusy(null);
    }
  }

  async function deletePost(post: FeedPost) {
    if (!userId || post.author_user_id !== userId || actionBusy) return;
    if (!window.confirm("Excluir esta publicação permanentemente?")) return;
    setActionBusy("delete-" + post.id);
    try {
      const { error } = await supabase
        .from("feed_posts")
        .delete()
        .eq("id", post.id)
        .eq("author_user_id", userId);
      if (error) throw error;
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setPostMenuId(null);
      if (modalPost?.id === post.id) closePostModal();
      setStatusMessage("Publicação excluída com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir publicação:", error);
      setStatusMessage("Não foi possível excluir esta publicação.");
    } finally {
      setActionBusy(null);
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
        setModalPost((current) => current?.id === post.id ? { ...current, like_count: Math.max(0, current.like_count - 1) } : current);
      } else {
        const { error } = await supabase.from("feed_likes").insert({ post_id: post.id, user_id: userId });
        if (error) throw error;
        setLikedIds((current) => [...current, post.id]);
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item, like_count: item.like_count + 1 } : item));
        setModalPost((current) => current?.id === post.id ? { ...current, like_count: current.like_count + 1 } : current);
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
      setModalPost((current) => current?.id === post.id ? { ...current, comment_count: current.comment_count + 1 } : current);
      await loadComments(post.id);
    } catch (error) {
      console.error("Erro ao comentar:", error);
      setStatusMessage("Não foi possível publicar o comentário.");
    } finally {
      setActionBusy(null);
    }
  }

  async function reviewPendingPublication(requestId: string, decision: "approved" | "rejected") {
    try {
      const { error } = await supabase.rpc("review_supplier_feed_publication", {
        p_request_id: requestId,
        p_decision: decision,
      });
      if (error) throw error;
      setPendingRequests((current) => current.filter((item) => item.id !== requestId));
      if (decision === "approved" && targetBusiness) await loadFeed(userId, targetBusiness.id);
      setStatusMessage(decision === "approved" ? "Publicação aprovada e adicionada ao Feed." : "Publicação recusada.");
    } catch (error) {
      console.error("Erro ao moderar publicação do Feed:", error);
      setStatusMessage("Não foi possível concluir a moderação.");
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
      setModalPost((current) => current?.id === post.id ? { ...current, repost_count: current.repost_count + 1 } : current);
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
        setModalPost((current) => current?.id === post.id ? { ...current, send_count: current.send_count + 1 } : current);
      }
    }

    setSendPostId(null);
  }

  function openComments(postId: string) {    const postForComments = posts.find((item) => item.id === postId) ?? modalPost;
    setCommentPostId(postId);
    if (postForComments) setCommentPostData(postForComments);
    setShowAllComments(true);
    setReplyToCommentId(null);
    setCommentDraft("");
    setCommentError((current) => ({ ...current, [postId]: "" }));
    void loadComments(postId);
  }

  function closeComments() {
    setCommentPostId(null);
    setCommentPostData(null);
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

  async function openPostModal(postId: string) {
    const existing = posts.find((item) => item.id === postId);
    if (existing) {
      setModalPost(existing);
      window.history.replaceState({}, "", "/feed?post=" + encodeURIComponent(postId));
      return;
    }

    setModalLoading(true);
    try {
      const { data, error } = await supabase
        .from("feed_post_rankings")
        .select("id,author_user_id,business_id,content,media_url,media_type,original_post_id,created_at,business_name,slug,city,state,logo_url,main_category,like_count,comment_count,repost_count,send_count,ranking_score")
        .eq("id", postId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setStatusMessage("Não foi possível localizar esta publicação.");
        return;
      }

      let post = { ...(data as FeedPost), active: true, mentions: [] };

      const { data: mentionRows, error: mentionError } = await supabase
        .from("feed_post_mentions")
        .select("post_id,business_id")
        .eq("post_id", postId);

      if (!mentionError && mentionRows?.length) {
        const ids = [...new Set(mentionRows.map((row) => row.business_id).filter(Boolean))];
        const { data: businesses } = await supabase
          .from("business_profiles")
          .select("id,business_name,slug")
          .in("id", ids)
          .eq("active", true)
          .eq("approval_status", "approved");

        const businessMap = new Map((businesses ?? []).map((business) => [business.id, business]));
        post = {
          ...post,
          mentions: mentionRows
            .map((row) => {
              const business = businessMap.get(row.business_id);
              return business?.business_name && business.slug
                ? { business_id: business.id, business_name: business.business_name, slug: business.slug }
                : null;
            })
            .filter((item): item is { business_id: string; business_name: string; slug: string } => Boolean(item)),
        };
      }

      setModalPost(post);
      window.history.replaceState({}, "", "/feed?post=" + encodeURIComponent(postId));
    } catch (error) {
      console.error("Erro ao abrir publicação no modal:", error);
      setStatusMessage("Não foi possível abrir esta publicação.");
    } finally {
      setModalLoading(false);
    }
  }

  function closePostModal() {
    if (commentPostId) closeComments();
    setModalPost(null);
    const params = new URLSearchParams(window.location.search);
    if (params.get("post")) window.history.replaceState({}, "", "/feed");
  }

  useEffect(() => {
    if (!modalPost) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalPost(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalPost]);

  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId || !authChecked) return;
    void openPostModal(postId);
  }, [authChecked]);

  const location = [profile?.city, profile?.state].filter(Boolean).join(" — ");
  const feedSequence = useMemo(() => buildFeedSequence(posts), [posts]);

  async function logout() {
    setMobileMenuOpen(false);
    await supabase.auth.signOut();
    window.location.href = "/entrar";
  }

  return (
    <main className="feed-page">
      {mobileMenuOpen && (
        <button
          type="button"
          className="feed-mobile-menu-overlay"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className={`feed-sidebar${mobileMenuOpen ? " mobile-open" : ""}`}>
        <div className="feed-sidebar-brand"><span>LOSI</span><strong>CONECTA</strong></div>
        <div className="feed-sidebar-caption">PAINEL PROFISSIONAL</div>
        <nav className="feed-sidebar-nav" aria-label="Menu do painel">
          <button type="button" className="feed-nav-item" onClick={() => { setMobileMenuOpen(false); window.location.href = "/painel"; }}>
            <span className="feed-nav-mark">01</span><span><strong>Visão geral</strong><small>Resumo da conta</small></span>
          </button>
          <button type="button" className="feed-nav-item" onClick={() => { setMobileMenuOpen(false); window.location.href = "/buscar"; }}>
            <span className="feed-nav-mark">02</span><span><strong>Fornecedores</strong><small>Encontrar parceiros</small></span>
          </button>
          <button type="button" className="feed-nav-item" onClick={() => { setMobileMenuOpen(false); window.location.href = "/meu-perfil"; }}>
            <span className="feed-nav-mark">03</span><span><strong>Meu perfil</strong><small>Dados pessoais</small></span>
          </button>
          <button type="button" className="feed-nav-item" onClick={() => { setMobileMenuOpen(false); window.location.href = "/meus-servicos"; }}>
            <span className="feed-nav-mark">04</span><span><strong>Minha empresa</strong><small>Serviços e presença</small></span>
          </button>
          <button type="button" className="feed-nav-item" onClick={() => { setMobileMenuOpen(false); window.location.href = "/notificar-inconsistencia"; }}>
            <span className="feed-nav-mark">05</span><span><strong>Notificar Inconsistências</strong><small>Falar com o administrador</small></span>
          </button>
          <button type="button" className="feed-nav-item" onClick={() => { setMobileMenuOpen(false); window.location.href = "/orcamentos"; }}>
            <span className="feed-nav-mark">06</span><span><strong>Orçamentos</strong><small>Solicitações e propostas</small></span>
          </button>
        </nav>
        <div className="feed-sidebar-footer">
          <div className="feed-sidebar-status"><span></span> Conta profissional</div>
          <button type="button" className="feed-sidebar-logout" onClick={() => void logout()}>Sair da conta</button>
        </div>
      </aside>
      <header className="feed-header">
        <div className="feed-header-inner">
          <button
            type="button"
            className="feed-mobile-menu-button"
            onClick={() => setMobileMenuOpen((value) => !value)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
          >
            <span></span><span></span><span></span>
          </button>
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
        <div className="feed-layout-menu-spacer" aria-hidden="true" />
        <div className="feed-main">
          <div className="feed-intro">
            <span className="feed-kicker">{targetMode ? "FEED DO FORNECEDOR" : "LOSI CONECTA"}</span>
            <h1>{targetMode && targetBusiness ? "Feed de " + targetBusiness.business_name : "Feed profissional"}</h1>
            <p>{targetMode ? "Publicações deste fornecedor, incluindo conteúdos enviados por fornecedores que ele segue e aprova." : "Publicações de fornecedores, trabalhos, eventos e novidades."}</p>
          </div>

          {targetMode && targetBusiness && pendingRequests.length > 0 && (
            <section className="feed-composer" aria-label="Publicações pendentes de aprovação">
              <div className="feed-composer-head">
                <div className="feed-avatar"><span>✓</span></div>
                <div className="feed-composer-identity">
                  <strong>Publicações aguardando aprovação</strong>
                  <span>{pendingRequests.length} publicação(ões) pendente(s)</span>
                </div>
              </div>
              <div className="feed-pending-list">
                {pendingRequests.map((request) => (
                  <article key={request.id} className="feed-pending-item">
                    <strong>{request.requester_name}</strong>
                    {request.post?.content && <p>{request.post.content}</p>}
                    {request.post?.media_url && request.post.media_type === "image" && <img src={request.post.media_url} alt="Conteúdo pendente" />}
                    {request.post?.media_url && request.post.media_type === "video" && <video src={request.post.media_url} controls />}
                    <div className="feed-post-edit-actions">
                      <button type="button" onClick={() => void reviewPendingPublication(request.id, "rejected")}>Recusar</button>
                      <button type="button" className="primary" onClick={() => void reviewPendingPublication(request.id, "approved")}>Aceitar publicação</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {targetMode && targetBusiness && userId && profile && profile.id !== targetBusiness.id && !targetFollowed && (
            <section className="feed-login-card">
              <strong>Siga este fornecedor para enviar uma publicação.</strong>
              <p>Somente fornecedores aprovados que seguem este fornecedor podem solicitar publicações no Feed dele.</p>
            </section>
          )}

          {authChecked && profile && (!targetMode || (targetBusiness && profile.id !== targetBusiness.id && targetFollowed)) ? (
            <section className="feed-composer" aria-label="Criar publicação">
              <div className="feed-composer-head">
                <div className="feed-avatar">
                  {profile.logo_url ? <img src={profile.logo_url} alt="" /> : <span>{profile.business_name.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="feed-composer-identity">
                  <strong>{targetMode && targetBusiness ? "Publicar no Feed de " + targetBusiness.business_name : profile.business_name}</strong>
                  <span>{targetMode ? "Sua publicação ficará aguardando a aprovação do fornecedor." : (location || "Fornecedor LOSI CONECTA")}</span>
                  {profile.main_category && <span className="feed-category">{profile.main_category}</span>}
                </div>
              </div>

              <div style={{ position: "relative" }}>
                <textarea
                  ref={postTextRef}
                  value={postText}
                  onChange={handlePostTextChange}
                  placeholder={targetMode ? "Escreva o conteúdo que deseja enviar para este Feed..." : "No que você está trabalhando? Use @ para marcar fornecedores salvos."}
                  aria-label="Texto da publicação"
                  maxLength={2000}
                />

                {mentionSuggestions.length > 0 && (
                  <div
                    className="feed-mention-suggestions"
                    role="listbox"
                    aria-label="Fornecedores salvos para marcar"
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: "100%",
                      zIndex: 30,
                      marginTop: 6,
                      background: "#fff",
                      border: "1px solid #d8dee8",
                      borderRadius: 12,
                      boxShadow: "0 12px 30px rgba(10,24,49,.16)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#8b6b1f", textTransform: "uppercase", letterSpacing: ".06em" }}>
                      Fornecedores salvos
                    </div>
                    {mentionSuggestions.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        role="option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectMention(supplier)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          border: 0,
                          borderTop: "1px solid #eef1f5",
                          background: "#fff",
                          color: "#17233a",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        {supplier.logo_url ? (
                          <img src={supplier.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flex: "0 0 auto" }} />
                        ) : (
                          <span style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: "#142744", color: "#d6ad4b", fontWeight: 800, flex: "0 0 auto" }}>
                            {supplier.business_name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span style={{ fontWeight: 700 }}>{supplier.business_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedMedia && (
                <div
                  className="feed-media-preview"
                  style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 280,
                    margin: "10px auto",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {selectedMedia.type === "image" ? (
                    <img
                      src={selectedMedia.url}
                      alt="Miniatura da imagem antes da publicação"
                      style={{ display: "block", width: "100%", height: 180, objectFit: "cover" }}
                    />
                  ) : (
                    <video
                      src={selectedMedia.url}
                      controls
                      aria-label="Miniatura do vídeo antes da publicação"
                      style={{ display: "block", width: "100%", height: 180, objectFit: "cover" }}
                    />
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
                  {publishing ? "Enviando..." : (targetMode ? "Enviar para aprovação" : "Publicar")}
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
                        {isRepost && (
                          <small className="feed-repost-label" style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            <span>Compartilhado de</span>
                            {post.original_business_slug && post.original_business_name ? (
                              <span className="feed-original-source">
                                {post.original_business_logo_url ? (
                                  <Link
                                    to="/fornecedor/$slug"
                                    params={{ slug: post.original_business_slug }}
                                    className="feed-repost-avatar-link"
                                    aria-label={"Abrir perfil público de " + post.original_business_name}
                                  >
                                    <img
                                      src={post.original_business_logo_url}
                                      alt=""
                                      style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }}
                                    />
                                  </Link>
                                ) : (
                                  <Link
                                    to="/fornecedor/$slug"
                                    params={{ slug: post.original_business_slug }}
                                    className="feed-repost-avatar-link"
                                    aria-label={"Abrir perfil público de " + post.original_business_name}
                                  >
                                    <span
                                      aria-hidden="true"
                                      style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-grid", placeItems: "center", background: "#142744", color: "#d6ad4b", fontWeight: 800 }}
                                    >
                                      {post.original_business_name.slice(0, 1).toUpperCase()}
                                    </span>
                                  </Link>
                                )}
                                <button
                                  type="button"
                                  className="feed-original-post-link"
                                  onClick={() => void openPostModal(post.original_post_id ?? post.id)}
                                >
                                  {post.original_business_name}
                                </button>
                              </span>
                            ) : (
                              <span>{post.original_business_name ?? "publicação original"}</span>
                            )}
                            <span>por</span>
                            <Link
                              to="/fornecedor/$slug"
                              params={{ slug: post.slug }}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700 }}
                            >
                              {post.logo_url ? (
                                <img src={post.logo_url} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                              ) : (
                                <span
                                  aria-hidden="true"
                                  style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-grid", placeItems: "center", background: "#142744", color: "#d6ad4b", fontWeight: 800 }}
                                >
                                  {post.business_name.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <span>{post.business_name}</span>
                            </Link>
                          </small>
                        )}
                        <strong>{post.business_name}</strong>
                        <span>{[post.city, post.state].filter(Boolean).join(" — ") || "LOSI CONECTA"} · {formatDate(post.created_at)}</span>
                        {post.main_category && <span className="feed-category">{post.main_category}</span>}
                      </div>
                      {userId === post.author_user_id && (
                        <div className="feed-post-menu-wrap">
                          <button type="button" className="feed-post-menu-button" aria-label="Opções da publicação" aria-expanded={postMenuId === post.id} onClick={() => setPostMenuId(postMenuId === post.id ? null : post.id)}>•••</button>
                          {postMenuId === post.id && (
                            <div className="feed-post-menu" role="menu">
                              <button type="button" onClick={() => startEditPost(post)}>Editar conteúdo</button>
                              <button type="button" onClick={() => void togglePostVisibility(post)}>{post.active ? "Ocultar conteúdo" : "Deixar visível"}</button>
                              <button type="button" className="danger" onClick={() => void deletePost(post)}>Excluir conteúdo</button>
                            </div>
                          )}
                        </div>
                      )}
                      <Link to="/fornecedor/$slug" params={{ slug: post.slug }} className="feed-profile-link">Ver perfil público</Link>
                    </div>

                    {!post.active && userId === post.author_user_id && <div className="feed-hidden-notice">Conteúdo oculto — somente você pode visualizar.</div>}
                    {editingPostId === post.id ? (
                      <div className="feed-post-edit-box">
                        <textarea value={editingPostText} onChange={(event) => setEditingPostText(event.target.value)} maxLength={2000} aria-label="Editar conteúdo da publicação" />
                        <div className="feed-post-edit-actions">
                          <button type="button" onClick={cancelEditPost}>Cancelar</button>
                          <button type="button" className="primary" onClick={() => void saveEditPost(post)} disabled={actionBusy === "edit-" + post.id}>{actionBusy === "edit-" + post.id ? "Salvando..." : "Salvar alterações"}</button>
                        </div>
                      </div>
                    ) : post.content ? <p className="feed-post-text">{renderPostContent(post.content, post.mentions, () => void openPostModal(post.id))}</p> : null}
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

          {modalPost && (
            <div
              className="feed-post-modal-overlay"
              role="presentation"
              onMouseDown={(event) => { if (event.target === event.currentTarget) closePostModal(); }}
            >
              <section className="feed-post-modal" role="dialog" aria-modal="true" aria-label="Publicação do Feed">
                <header className="feed-post-modal-head">
                  <strong>Publicação</strong>
                  <button type="button" className="feed-post-modal-close" onClick={closePostModal} aria-label="Fechar publicação">×</button>
                </header>

                {modalLoading ? (
                  <div className="feed-post-modal-loading">Carregando publicação...</div>
                ) : (
                  <article className="feed-post feed-post-modal-card">
                    <div className="feed-post-head">
                      <Link
                        to="/fornecedor/$slug"
                        params={{ slug: modalPost.slug }}
                        className="feed-avatar"
                        aria-label={"Abrir perfil público de " + modalPost.business_name}
                      >
                        {modalPost.logo_url ? <img src={modalPost.logo_url} alt="" /> : <span>{modalPost.business_name.slice(0, 1).toUpperCase()}</span>}                      </Link>
                      <div className="feed-post-identity">
                        <Link to="/fornecedor/$slug" params={{ slug: modalPost.slug }} className="feed-modal-author-link">
                          <strong>{modalPost.business_name}</strong>
                        </Link>
                        <span>{[modalPost.city, modalPost.state].filter(Boolean).join(" — ") || "LOSI CONECTA"} · {formatDate(modalPost.created_at)}</span>
                        {modalPost.main_category && <span className="feed-category">{modalPost.main_category}</span>}
                      </div>
                      {userId === modalPost.author_user_id && (
                        <div className="feed-post-menu-wrap">
                          <button type="button" className="feed-post-menu-button" aria-label="Opções da publicação" aria-expanded={postMenuId === modalPost.id} onClick={() => setPostMenuId(postMenuId === modalPost.id ? null : modalPost.id)}>•••</button>
                          {postMenuId === modalPost.id && (
                            <div className="feed-post-menu" role="menu">
                              <button type="button" onClick={() => startEditPost(modalPost)}>Editar conteúdo</button>
                              <button type="button" onClick={() => void togglePostVisibility(modalPost)}>{modalPost.active ? "Ocultar conteúdo" : "Deixar visível"}</button>
                              <button type="button" className="danger" onClick={() => void deletePost(modalPost)}>Excluir conteúdo</button>
                            </div>
                          )}
                        </div>
                      )}
                      <Link to="/fornecedor/$slug" params={{ slug: modalPost.slug }} className="feed-profile-link">Ver perfil público</Link>
                    </div>

                    {!modalPost.active && userId === modalPost.author_user_id && <div className="feed-hidden-notice">Conteúdo oculto — somente você pode visualizar.</div>}
                    {editingPostId === modalPost.id ? (
                      <div className="feed-post-edit-box">
                        <textarea value={editingPostText} onChange={(event) => setEditingPostText(event.target.value)} maxLength={2000} aria-label="Editar conteúdo da publicação" />
                        <div className="feed-post-edit-actions">
                          <button type="button" onClick={cancelEditPost}>Cancelar</button>
                          <button type="button" className="primary" onClick={() => void saveEditPost(modalPost)} disabled={actionBusy === "edit-" + modalPost.id}>{actionBusy === "edit-" + modalPost.id ? "Salvando..." : "Salvar alterações"}</button>
                        </div>
                      </div>
                    ) : modalPost.content && (
                      <p className="feed-post-text">
                        {renderPostContent(modalPost.content, modalPost.mentions, () => void openPostModal(modalPost.id))}
                      </p>
                    )}
                    {modalPost.media_url && modalPost.media_type === "image" && <img className="feed-post-media" src={modalPost.media_url} alt="Imagem da publicação" />}
                    {modalPost.media_url && modalPost.media_type === "video" && <video className="feed-post-media" src={modalPost.media_url} controls />}

                    <div className="feed-post-actions">
                      <div className="feed-action-group">
                        <button type="button" className={likedIds.includes(modalPost.id) ? "is-liked" : ""} onClick={() => void toggleLike(modalPost)} disabled={actionBusy === "like-" + modalPost.id}>
                          <span className="feed-action-icon"><FeedActionIcon type="like" /></span>
                          <span className="feed-action-label">Curtir</span>
                        </button>
                        <small>{modalPost.like_count}</small>
                      </div>
                      <div className="feed-action-group">
                        <button type="button" aria-expanded={commentPostId === modalPost.id} onClick={() => openComments(modalPost.id)}>
                          <span className="feed-action-icon"><FeedActionIcon type="comment" /></span>
                          <span className="feed-action-label">Comentar</span>
                        </button>
                        <small>{modalPost.comment_count}</small>
                      </div>
                      <div className="feed-action-group">
                        <button type="button" aria-label="Compartilhar publicação no meu Feed" onClick={() => void repostPost(modalPost)} disabled={actionBusy === "repost-" + modalPost.id}>
                          <span className="feed-action-icon"><FeedActionIcon type="share" /></span>
                          <span className="feed-action-label">Compartilhar</span>
                        </button>
                        <small>{modalPost.repost_count}</small>
                      </div>
                      <div className="feed-action-group">
                        <button type="button" onClick={() => setSendPostId(sendPostId === modalPost.id ? null : modalPost.id)}>
                          <span className="feed-action-icon"><FeedActionIcon type="send" /></span>
                          <span className="feed-action-label">Enviar</span>
                        </button>
                        <small>{modalPost.send_count}</small>
                      </div>
                    </div>

                    {sendPostId === modalPost.id && (
                      <div className="feed-send-panel" aria-label="Enviar publicação">
                        <button type="button" onClick={() => void sendPost(modalPost, "whatsapp")}>WhatsApp</button>
                        <button type="button" onClick={() => void sendPost(modalPost, "copy")}>Copiar link</button>
                      </div>
                    )}
                  </article>
                )}
              </section>
            </div>
          )}

          {commentPostId && (() => {
            const activePost = posts.find((item) => item.id === commentPostId) ?? commentPostData;
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