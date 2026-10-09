//! Patrones glob, como los de KEYS, SCAN MATCH y PSUBSCRIBE. Etapa 40.

/// Si `text` coincide con `pattern`, con las reglas de `stringmatchlen` de Redis:
/// `*`, `?`, `[abc]`, `[^abc]`, `[a-z]` y `\` para escapar.
pub fn glob_match(pattern: &[u8], text: &[u8]) -> bool {
  todo!("etapa 40")
}
