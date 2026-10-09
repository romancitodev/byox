use miredis::resp::{Value, parse};

#[test]
fn array_vacio() {
  assert_eq!(parse(b"*0\r\n"), Ok(Some((Value::Array(vec![]), 4))));
}

#[test]
fn arrays_anidados() {
  let raw = b"*2\r\n*2\r\n:1\r\n:2\r\n*1\r\n+x\r\n";
  let expected = Value::Array(vec![
    Value::Array(vec![Value::Integer(1), Value::Integer(2)]),
    Value::Array(vec![Value::Simple("x".into())]),
  ]);
  assert_eq!(parse(raw), Ok(Some((expected, raw.len()))));
}
