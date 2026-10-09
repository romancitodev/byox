use miredis::resp::{Value, parse};

#[test]
fn un_comando() {
  let raw = b"*2\r\n$4\r\nECHO\r\n$4\r\nhola\r\n";
  let expected = Value::Array(vec![Value::Bulk(b"ECHO".to_vec()), Value::Bulk(b"hola".to_vec())]);
  assert_eq!(parse(raw), Ok(Some((expected, raw.len()))));
}

#[test]
fn tipos_mezclados() {
  let raw = b"*3\r\n:1\r\n+dos\r\n$4\r\ntres\r\n";
  let expected = Value::Array(vec![Value::Integer(1), Value::Simple("dos".into()), Value::Bulk(b"tres".to_vec())]);
  assert_eq!(parse(raw), Ok(Some((expected, raw.len()))));
}
