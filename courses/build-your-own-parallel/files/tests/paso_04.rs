use rustminario::reduce::reduce_with;

#[test]
fn minimo_con_neutro_infinito() {
  let a = [7, 3, 9, -2, 5];
  assert_eq!(reduce_with(&a, 2, i64::MAX, |x, y| x.min(y)), -2);
  let vacio: &[i64] = &[];
  assert_eq!(reduce_with(vacio, 2, i64::MAX, |x, y| x.min(y)), i64::MAX);
}

#[test]
fn concatenar_respeta_el_orden() {
  let letras: Vec<String> = "paralelismo".chars().map(String::from).collect();
  for p in 1..=6 {
    let r = reduce_with(&letras, p, String::new(), |x, y| x + &y);
    assert_eq!(r, "paralelismo");
  }
}

#[test]
fn promedio_como_tupla() {
  let a: Vec<(i64, i64)> = [4, 8, 6, 2].iter().map(|&x| (x, 1)).collect();
  let (s, c) = reduce_with(&a, 2, (0, 0), |(s1, c1), (s2, c2)| (s1 + s2, c1 + c2));
  assert_eq!(s / c, 5);
}
