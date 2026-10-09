use miredis::resp::{Value, parse};

#[test]
fn bulk_strings() {
  assert_eq!(parse(b"$5\r\nhello\r\n"), Ok(Some((Value::Bulk(b"hello".to_vec()), 11))));
  assert_eq!(parse(b"$10\r\nhola mundo\r\n"), Ok(Some((Value::Bulk(b"hola mundo".to_vec()), 17))));
}

#[test]
fn bulk_vacio() {
  assert_eq!(parse(b"$0\r\n\r\n"), Ok(Some((Value::Bulk(Vec::new()), 6))));
}

#[test]
fn lee_solo_el_primero() {
  assert_eq!(parse(b"$2\r\nok\r\n:1\r\n"), Ok(Some((Value::Bulk(b"ok".to_vec()), 8))));
}
