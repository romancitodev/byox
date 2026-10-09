use miredis::resp::{Value, parse};

#[test]
fn con_crlf_adentro() {
  // El largo manda: un \r\n adentro del contenido no termina el bulk string.
  assert_eq!(parse(b"$6\r\na\r\nb\x00c\r\n"), Ok(Some((Value::Bulk(b"a\r\nb\x00c".to_vec()), 12))));
}

#[test]
fn bytes_que_no_son_utf8() {
  assert_eq!(parse(b"$3\r\n\xff\xfe\x00\r\n"), Ok(Some((Value::Bulk(vec![0xff, 0xfe, 0x00]), 9))));
}
