use std::collections::HashMap;

use wc::word_frequencies;

fn map(pairs: &[(&str, usize)]) -> HashMap<String, usize> {
  pairs.iter().map(|&(w, n)| (w.to_string(), n)).collect()
}

#[test]
fn cuenta_repetidas() {
  assert_eq!(word_frequencies("el gato y el perro"), map(&[("el", 2), ("gato", 1), ("y", 1), ("perro", 1)]));
}

#[test]
fn sin_distinguir_mayusculas() {
  assert_eq!(word_frequencies("Hola hola HOLA"), map(&[("hola", 3)]));
}

#[test]
fn vacio() {
  assert!(word_frequencies("").is_empty());
}
