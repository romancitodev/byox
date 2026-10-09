mod common;
use common::*;

#[test]
fn largo_en_bytes() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["STRLEN", "nada"]), Reply::Int(0));
  c.cmd(&["SET", "k", "hola"]);
  assert_eq!(c.cmd(&["STRLEN", "k"]), Reply::Int(4));
  // Bytes, no caracteres: "ñ" ocupa dos en UTF-8.
  c.cmd(&["SET", "ñ", "ñandú"]);
  assert_eq!(c.cmd(&["STRLEN", "ñ"]), Reply::Int(7));
}
