use rustminario::reduce::{slice, slice_size};

#[test]
fn tam_como_en_python() {
  assert_eq!(slice_size(8, 2), 4);
  assert_eq!(slice_size(8, 3), 3);
  assert_eq!(slice_size(3, 8), 1);
  assert_eq!(slice_size(0, 4), 1);
}

#[test]
fn pedazos_cubren_todo_sin_copiar() {
  let a: Vec<i64> = (0..10).collect();
  for p in 1..=12 {
    let ps = slice(&a, p);
    assert!(ps.len() <= p);
    assert_eq!(ps.concat(), a);
    // el primer pedazo apunta a la misma memoria que el original
    assert_eq!(ps[0].as_ptr(), a.as_ptr());
  }
}

#[test]
fn vacio_da_cero_pedazos() {
  let a: Vec<i64> = vec![];
  assert!(slice(&a, 4).is_empty());
}

#[test]
#[should_panic]
fn p_cero_es_un_error() {
  slice(&[1, 2, 3], 0);
}
