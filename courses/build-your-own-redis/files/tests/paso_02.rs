use miredis::resp::{Value, parse};

#[test]
fn errores_de_redis() {
  let e = b"-ERR unknown command 'FOO'\r\n";
  assert_eq!(parse(e), Ok(Some((Value::Error("ERR unknown command 'FOO'".into()), e.len()))));
  let w = b"-WRONGTYPE Operation against a key holding the wrong kind of value\r\n";
  assert_eq!(
    parse(w),
    Ok(Some((Value::Error("WRONGTYPE Operation against a key holding the wrong kind of value".into()), w.len())))
  );
}
