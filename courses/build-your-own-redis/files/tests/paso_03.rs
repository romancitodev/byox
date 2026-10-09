use miredis::resp::{Value, parse};

#[test]
fn enteros() {
  assert_eq!(parse(b":0\r\n"), Ok(Some((Value::Integer(0), 4))));
  assert_eq!(parse(b":1000\r\n"), Ok(Some((Value::Integer(1000), 7))));
  assert_eq!(parse(b":-42\r\n"), Ok(Some((Value::Integer(-42), 6))));
}

#[test]
fn los_extremos_de_un_i64() {
  assert_eq!(parse(b":9223372036854775807\r\n"), Ok(Some((Value::Integer(i64::MAX), 22))));
  assert_eq!(parse(b":-9223372036854775808\r\n"), Ok(Some((Value::Integer(i64::MIN), 23))));
}
