use std::collections::HashMap;

/// Cuántas palabras tiene `text`. Ver issue #1.
pub fn count_words(text: &str) -> usize {
  text.split_whitespace().count()
}

/// Cuántas veces aparece cada palabra, sin distinguir mayúsculas. Ver issue #2.
pub fn word_frequencies(text: &str) -> HashMap<String, usize> {
  let mut out = HashMap::new();
  for word in text.split_whitespace() {
    *out.entry(word.to_lowercase()).or_insert(0) += 1;
  }
  out
}
