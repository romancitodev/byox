use miredis::resp::{Value, parse};

#[test]
fn array_nulo() {
  assert_eq!(parse(b"*-1\r\n"), Ok(Some((Value::NullArray, 5))));
}

#[test]
fn nulos_adentro_de_un_array() {
  // Así responde MGET cuando una clave no existe.
  let raw = b"*3\r\n$1\r\n1\r\n$-1\r\n$1\r\n2\r\n";
  let expected = Value::Array(vec![Value::Bulk(b"1".to_vec()), Value::NullBulk, Value::Bulk(b"2".to_vec())]);
  assert_eq!(parse(raw), Ok(Some((expected, raw.len()))));
}
