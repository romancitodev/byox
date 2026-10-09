use rustminario::merge::merge;

#[test]
fn ejercicio_7() {
  let a = [2, 5, 8, 9, 14];
  let b = [1, 5, 7, 10, 12];
  let mut out = [0; 10];
  merge(&a, &b, &mut out);
  assert_eq!(out, [1, 2, 5, 5, 7, 8, 9, 10, 12, 14]);
}

#[test]
fn un_lado_vacio() {
  let mut out = [0; 3];
  merge(&[], &[1, 2, 3], &mut out);
  assert_eq!(out, [1, 2, 3]);
  merge(&[4, 5, 6], &[], &mut out);
  assert_eq!(out, [4, 5, 6]);
}

#[test]
#[should_panic]
fn largo_incorrecto() {
  let mut out = [0; 2];
  merge(&[1, 2], &[3], &mut out);
}
