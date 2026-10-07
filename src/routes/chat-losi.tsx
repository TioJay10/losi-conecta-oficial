import { createFileRoute } from "@tanstack/react-router";
import { LosiChatPreview } from "../components/LosiChatPreview";
export const Route = createFileRoute("/chat-losi")({component:LosiChatPreview});
