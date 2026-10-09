import { createFileRoute } from "@tanstack/react-router";
import { LosiPublicForm } from "../components/LosiPublicForm";
export const Route = createFileRoute("/formulario/$token")({
  validateSearch: (search: Record<string, unknown>) => ({
    canal: search.canal === "fornecedor" ? "fornecedor" : undefined,
  }),
  component: PublicFormPage,
});
function PublicFormPage() {
  const { token } = Route.useParams();
  const { canal } = Route.useSearch();
  return <LosiPublicForm token={token} supplier={canal === "fornecedor"} />;
}
