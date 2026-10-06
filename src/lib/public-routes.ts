/** Public collaborator links use their own identity, independent of supplier login. */
export function isPublicPath(path: string): boolean {
  return ["/", "/entrar", "/buscar", "/faq", "/colaborador"].includes(path.replace(/\/$/, "") || "/") ||
    ["/fornecedor/", "/calendario/", "/oportunidade/"].some(prefix => path.startsWith(prefix));
}
