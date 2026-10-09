import { createFileRoute } from "@tanstack/react-router";
import { LosiForms } from "../components/LosiForms";
export const Route = createFileRoute("/formularios")({ component: LosiForms });
