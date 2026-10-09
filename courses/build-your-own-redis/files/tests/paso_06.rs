use miredis::resp::{Value, parse};

#[test]
fn bulk_nulo() {
  assert_eq!(parse(b"$-1\r\n"), Ok(Some((Value::NullBulk, 5))));
}

#[test]
fn nulo_no_es_vacio() {
  assert_ne!(parse(b"$-1\r\n"), parse(b"$0\r\n\r\n"));
}
