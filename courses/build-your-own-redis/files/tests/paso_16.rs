mod common;
use common::*;
use std::thread;

#[test]
fn un_cliente_quieto_no_frena_a_los_demas() {
  let server = start();
  let _quieto = connect(&server); // se conecta y no manda nada
  let mut otro = connect(&server);
  assert_eq!(otro.cmd(&["PING"]), Reply::simple("PONG"));
}

#[test]
fn conexiones_intercaladas() {
  let server = start();
  let mut a = connect(&server);
  let mut b = connect(&server);
  for _ in 0..5 {
    assert_eq!(a.cmd(&["PING"]), Reply::simple("PONG"));
    assert_eq!(b.cmd(&["PING"]), Reply::simple("PONG"));
  }
}

#[test]
fn muchos_clientes_en_paralelo() {
  let server = start();
  let hilos: Vec<_> = (0..20)
    .map(|_| {
      let mut c = connect(&server);
      thread::spawn(move || {
        for _ in 0..50 {
          assert_eq!(c.cmd(&["PING"]), Reply::simple("PONG"));
        }
      })
    })
    .collect();
  for h in hilos {
    h.join().unwrap();
  }
}
