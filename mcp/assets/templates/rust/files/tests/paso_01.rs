use wc::count_words;

#[test]
fn simple() {
  assert_eq!(count_words("hola mundo"), 2);
}

#[test]
fn espacios_de_mas() {
  assert_eq!(count_words("  el   gato\ty\nel perro  "), 5);
}

#[test]
fn vacio() {
  assert_eq!(count_words(""), 0);
  assert_eq!(count_words("   \n"), 0);
}
