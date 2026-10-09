//! cargo run --example demo -- "el gato y el perro"

fn main() {
  let text = std::env::args().nth(1).unwrap_or_default();
  println!("{} palabras", wc::count_words(&text));
  let mut freq: Vec<_> = wc::word_frequencies(&text).into_iter().collect();
  freq.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
  for (word, n) in freq {
    println!("{n:>3} {word}");
  }
}
