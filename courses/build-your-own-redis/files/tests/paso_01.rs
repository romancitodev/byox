use miredis::resp::{Value, parse};

#[test]
fn un_simple_string() {
  assert_eq!(parse(b"+OK\r\n"), Ok(Some((Value::Simple("OK".into()), 5))));
}

#[test]
fn con_espacios_y_vacio() {
  assert_eq!(parse(b"+hola mundo\r\n"), Ok(Some((Value::Simple("hola mundo".into()), 13))));
  assert_eq!(parse(b"+\r\n"), Ok(Some((Value::Simple("".into()), 3))));
}

#[test]
fn lee_solo_el_primero() {
  // Lo que viene después es el próximo valor: no se toca.
  assert_eq!(parse(b"+OK\r\n+PONG\r\n"), Ok(Some((Value::Simple("OK".into()), 5))));
}
