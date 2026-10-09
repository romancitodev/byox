use miredis::resp::{Value, encode};

#[test]
fn valores_simples() {
  assert_eq!(encode(&Value::Simple("OK".into())), b"+OK\r\n");
  assert_eq!(encode(&Value::Error("ERR syntax error".into())), b"-ERR syntax error\r\n");
  assert_eq!(encode(&Value::Integer(-3)), b":-3\r\n");
}

#[test]
fn bulk_strings() {
  assert_eq!(encode(&Value::Bulk(b"hola".to_vec())), b"$4\r\nhola\r\n");
  assert_eq!(encode(&Value::Bulk(Vec::new())), b"$0\r\n\r\n");
  assert_eq!(encode(&Value::Bulk(b"a\r\nb".to_vec())), b"$4\r\na\r\nb\r\n");
  assert_eq!(encode(&Value::NullBulk), b"$-1\r\n");
}

#[test]
fn arrays() {
  let v = Value::Array(vec![Value::Bulk(b"SET".to_vec()), Value::Bulk(b"k".to_vec()), Value::Integer(1)]);
  assert_eq!(encode(&v), b"*3\r\n$3\r\nSET\r\n$1\r\nk\r\n:1\r\n");
  assert_eq!(encode(&Value::Array(vec![])), b"*0\r\n");
  assert_eq!(encode(&Value::NullArray), b"*-1\r\n");
  let nested = Value::Array(vec![Value::Array(vec![Value::NullBulk])]);
  assert_eq!(encode(&nested), b"*1\r\n*1\r\n$-1\r\n");
}
