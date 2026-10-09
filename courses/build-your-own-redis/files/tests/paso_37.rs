mod common;
use common::*;

#[test]
fn nx_solo_si_no_existe() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["SET", "k", "v1", "NX"]), Reply::ok());
  assert_eq!(c.cmd(&["SET", "k", "v2", "NX"]), Reply::Nil);
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("v1"));
}

#[test]
fn xx_solo_si_existe() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["SET", "z", "v", "XX"]), Reply::Nil);
  assert_eq!(c.cmd(&["GET", "z"]), Reply::Nil);
  c.cmd(&["SET", "k", "v1"]);
  assert_eq!(c.cmd(&["SET", "k", "v3", "xx"]), Reply::ok());
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("v3"));
}
