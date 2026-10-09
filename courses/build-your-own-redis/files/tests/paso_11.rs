use miredis::resp::parse;

#[test]
fn tipo_desconocido() {
  assert!(parse(b"!hola\r\n").is_err());
  // No hace falta esperar el fin de línea para saber que es inválido.
  assert!(parse(b"?").is_err());
}

#[test]
fn largos_y_numeros_invalidos() {
  assert!(parse(b"$abc\r\n").is_err());
  assert!(parse(b"*x\r\n").is_err());
  assert!(parse(b":12a\r\n").is_err());
  assert!(parse(b"$-5\r\n").is_err());
}

#[test]
fn bulk_que_no_termina_en_crlf() {
  assert!(parse(b"$3\r\nholaX\r\n").is_err());
}

#[test]
fn error_adentro_de_un_array() {
  assert!(parse(b"*2\r\n:1\r\n!x\r\n").is_err());
}
